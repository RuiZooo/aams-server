'use strict';

const Service = require('egg').Service;

function fail(message) {
  return {
    success: false,
    message,
  };
}

function diffDays(start, end) {
  if (!start) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return null;
  return Math.max(Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000)), 0);
}

class CheckoutService extends Service {

  async checkout(data = {}) {
    const { app } = this;

    const personId = Number(data.personId || data.person_id);
    if (!Number.isInteger(personId) || personId <= 0) return fail('人员ID不合法');

    const person = await app.mysql.get('persons', {
      id: personId,
      status: 'staying',
    });

    if (!person) return fail('人员不存在或已退房');

    const room = await app.mysql.get('rooms', {
      id: person.room_id,
    });

    if (!room) return fail('房间不存在');

    try {
      await app.mysql.beginTransactionScope(async conn => {
        const lockedPersons = await conn.query(
          "SELECT * FROM persons WHERE id = ? AND status = 'staying' FOR UPDATE",
          [ person.id ]
        );
        const lockedRooms = await conn.query(
          'SELECT * FROM rooms WHERE id = ? FOR UPDATE',
          [ room.id ]
        );

        const lockedPerson = lockedPersons[0];
        const lockedRoom = lockedRooms[0];

        if (!lockedPerson || !lockedRoom) {
          throw new Error('CHECKOUT_STATE_CHANGED');
        }

        const now = new Date();
        const days = diffDays(lockedPerson.checkin_time, now);

        await conn.update('persons', {
          status: 'checkout',
          checkout_time: now,
        }, {
          where: { id: lockedPerson.id },
        });

        await conn.query(
          `
            UPDATE rooms
            SET
              used = GREATEST(used - 1, 0),
              team_id = CASE WHEN used <= 1 THEN NULL ELSE team_id END
            WHERE id = ?
          `,
          [ lockedRoom.id ]
        );

        await conn.insert('stay_records', {
          person_id: lockedPerson.id,
          room_id: lockedRoom.id,
          action_type: 'checkout',
          checkin_time: lockedPerson.checkin_time,
          checkout_time: now,
          days,
        });

        await conn.insert('billing_ledger', {
          person_id: lockedPerson.id,
          room_id: lockedRoom.id,
          type: 'checkout',
          amount: 0,
          remark: '退房结算',
          status: 'pending',
          created_at: now,
        });

        await conn.insert('operation_logs', {
          operator: 'system',
          action: 'person.checkout',
          detail: JSON.stringify({
            person_id: lockedPerson.id,
            room_id: lockedRoom.id,
          }),
          created_at: now,
        });

        return true;
      });
    } catch (err) {
      if (err.message === 'CHECKOUT_STATE_CHANGED') {
        return fail('退房状态已变化，请刷新后重试');
      }
      throw err;
    }

    return {
      success: true,
      message: '退房成功',
    };
  }
}

module.exports = CheckoutService;
