'use strict';

const Service = require('egg').Service;

function fail(message) {
  return {
    success: false,
    message,
  };
}

function toPositiveInteger(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function canUseRoom(room, gender) {
  return room &&
    room.status === 'active' &&
    room.used < room.capacity &&
    (room.gender === 'mixed' || room.gender === gender);
}

class RoomTransferService extends Service {

  async transfer(data = {}) {
    const { app } = this;

    const personId = toPositiveInteger(data.personId || data.person_id);
    const targetRoomId = toPositiveInteger(data.targetRoomId || data.target_room_id);

    if (!personId || !targetRoomId) return fail('参数不完整');

    const person = await app.mysql.get('persons', {
      id: personId,
      status: 'staying',
    });

    if (!person) return fail('人员不存在或已退房');

    const oldRoom = await app.mysql.get('rooms', {
      id: person.room_id,
    });

    const targetRoom = await app.mysql.get('rooms', {
      id: targetRoomId,
    });

    if (!oldRoom) return fail('原房间不存在');
    if (!targetRoom) return fail('目标房间不存在');
    if (oldRoom.id === targetRoom.id) return fail('人员已在目标房间');

    try {
      await app.mysql.beginTransactionScope(async conn => {
        const lockedOldRooms = await conn.query(
          'SELECT * FROM rooms WHERE id = ? FOR UPDATE',
          [ oldRoom.id ]
        );
        const lockedTargetRooms = await conn.query(
          'SELECT * FROM rooms WHERE id = ? FOR UPDATE',
          [ targetRoom.id ]
        );

        const lockedOldRoom = lockedOldRooms[0];
        const lockedTargetRoom = lockedTargetRooms[0];

        if (!lockedOldRoom || !canUseRoom(lockedTargetRoom, person.gender)) {
          throw new Error('ROOM_UNAVAILABLE');
        }

        const now = new Date();

        await conn.query(
          `
            UPDATE rooms
            SET
              used = GREATEST(used - 1, 0),
              team_id = CASE WHEN used <= 1 THEN NULL ELSE team_id END
            WHERE id = ?
          `,
          [ lockedOldRoom.id ]
        );

        await conn.query(
          `
            UPDATE rooms
            SET
              team_id = CASE WHEN used = 0 THEN ? ELSE team_id END,
              used = used + 1
            WHERE id = ?
          `,
          [ person.team_id, lockedTargetRoom.id ]
        );

        await conn.update('persons', {
          room_id: lockedTargetRoom.id,
        }, {
          where: { id: person.id },
        });

        await conn.insert('stay_records', {
          person_id: person.id,
          room_id: lockedTargetRoom.id,
          action_type: 'transfer',
          checkin_time: now,
        });

        await conn.insert('billing_ledger', {
          person_id: person.id,
          room_id: lockedTargetRoom.id,
          type: 'transfer',
          amount: 0,
          remark: '房间调整',
          status: 'pending',
          created_at: now,
        });

        await conn.insert('operation_logs', {
          operator: 'system',
          action: 'person.transferRoom',
          detail: JSON.stringify({
            person_id: person.id,
            old_room_id: lockedOldRoom.id,
            new_room_id: lockedTargetRoom.id,
          }),
          created_at: now,
        });

        return true;
      });
    } catch (err) {
      if (err.message === 'ROOM_UNAVAILABLE') {
        return fail('目标房间不可用');
      }
      throw err;
    }

    return {
      success: true,
      data: {
        oldRoom: oldRoom.room_no,
        newRoom: targetRoom.room_no,
      },
    };
  }
}

module.exports = RoomTransferService;
