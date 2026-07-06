'use strict';

const Service = require('egg').Service;

const VALID_GENDERS = [ 'male', 'female' ];

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function fail(message) {
  return {
    success: false,
    message,
  };
}

function toNullableInteger(value) {
  if (!hasValue(value)) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function parseDate(value) {
  if (!hasValue(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function canUseRoom(room, gender) {
  return room &&
    room.status === 'active' &&
    room.used < room.capacity &&
    (room.gender === 'mixed' || room.gender === gender);
}

class CheckinService extends Service {

  async checkin(data = {}) {
    const { app } = this;

    const name = String(data.name || '').trim();
    const phone = String(data.phone || '').trim();
    const gender = data.gender;
    const teamId = toNullableInteger(data.teamId || data.team_id);
    const expectedCheckoutTime = parseDate(data.expectedCheckoutTime || data.expected_checkout_time);

    if (!name) return fail('姓名不能为空');
    if (!phone) return fail('手机号不能为空');
    if (!VALID_GENDERS.includes(gender)) return fail('性别不合法');
    if ((hasValue(data.teamId) || hasValue(data.team_id)) && teamId === null) return fail('团队ID不合法');
    if ((hasValue(data.expectedCheckoutTime) || hasValue(data.expected_checkout_time)) && !expectedCheckoutTime) {
      return fail('预计退房时间不合法');
    }

    const exist = await app.mysql.get('persons', {
      phone,
      status: 'staying',
    });

    if (exist) {
      const room = await app.mysql.get('rooms', {
        id: exist.room_id,
      });

      return {
        success: true,
        data: {
          personId: exist.id,
          room,
          repeated: true,
        },
      };
    }

    const rooms = await app.mysql.select('rooms');
    const personForSchedule = {
      name,
      phone,
      gender,
      team_id: teamId,
    };

    const results = await this.service.abScheduler.runAllStrategies(
      rooms,
      personForSchedule
    );

    if (!results.length) {
      return fail('暂无可用房间');
    }

    const best = results[0];

    try {
      return await app.mysql.beginTransactionScope(async conn => {
        const lockedRooms = await conn.query(
          'SELECT * FROM rooms WHERE id = ? FOR UPDATE',
          [ best.room.id ]
        );
        const room = lockedRooms[0];

        if (!canUseRoom(room, gender)) {
          throw new Error('ROOM_UNAVAILABLE');
        }

        const now = new Date();
        const insertRes = await conn.insert('persons', {
          name,
          phone,
          gender,
          team_id: teamId,
          room_id: room.id,
          status: 'staying',
          checkin_time: now,
          expected_checkout_time: expectedCheckoutTime,
          remark: hasValue(data.remark) ? String(data.remark).trim() : null,
        });

        const personId = insertRes.insertId;

        await conn.query(
          `
            UPDATE rooms
            SET
              team_id = CASE WHEN used = 0 THEN ? ELSE team_id END,
              used = used + 1
            WHERE id = ?
          `,
          [ teamId, room.id ]
        );

        await conn.insert('stay_records', {
          person_id: personId,
          room_id: room.id,
          action_type: 'checkin',
          checkin_time: now,
        });

        await conn.insert('billing_ledger', {
          person_id: personId,
          room_id: room.id,
          type: 'checkin',
          amount: 0,
          remark: '入住登记',
          status: 'pending',
          created_at: now,
        });

        await conn.insert('operation_logs', {
          operator: 'system',
          action: 'person.checkin',
          detail: JSON.stringify({
            person_id: personId,
            room_id: room.id,
            strategy_id: best.strategy.id,
          }),
          created_at: now,
        });

        return {
          success: true,
          data: {
            personId,
            room,
            strategy: best.strategy.name,
            score: best.score,
          },
        };
      });
    } catch (err) {
      if (err.message === 'ROOM_UNAVAILABLE') {
        return fail('目标房间已不可用，请重新分配');
      }
      throw err;
    }
  }
}

module.exports = CheckinService;
