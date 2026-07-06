'use strict';

const Service = require('egg').Service;

function diffDays(start, end) {
  if (!start) return null;
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  if (Number.isNaN(startTime) || Number.isNaN(endTime)) return null;
  return Math.max(Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000)), 0);
}

class CheckoutService extends Service {
  /**
   * 退房核心逻辑
   * 包含：释放床位、房间洗白（如果全空）、结算账单流水
   */
  async checkout({ personId }) {
    const { app } = this;

    const person = await app.mysql.get('persons', { id: personId, status: 'staying' });
    if (!person) throw new Error('人员不存在或已退房');

    const result = await app.mysql.beginTransactionScope(async conn => {
      // 1. 锁定人员和当前所在房间
      const lockedPersons = await conn.query(
        "SELECT * FROM persons WHERE id = ? AND status = 'staying' FOR UPDATE",
        [person.id]
      );
      const lockedRooms = await conn.query(
        'SELECT * FROM rooms WHERE id = ? FOR UPDATE',
        [person.room_id]
      );

      const lockedPerson = lockedPersons[0];
      const lockedRoom = lockedRooms[0];

      if (!lockedPerson || !lockedRoom) {
        throw new Error('退房状态已在其他终端发生变化，请刷新');
      }

      const now = new Date();
      const days = diffDays(lockedPerson.checkin_time, now);

      // 2. 更新人员状态
      await conn.update('persons', {
        status: 'checkout',
        checkout_time: now,
      }, { where: { id: lockedPerson.id } });

      // 3. 释放床位 & 终极洗白逻辑
      // 如果退房后 used 变为 0，必须重置性别为 mixed，清空 team_id 和 tags
      await conn.query(`
        UPDATE rooms SET
          used = GREATEST(used - 1, 0),
          gender = CASE WHEN used - 1 <= 0 THEN 'mixed' ELSE gender END,
          team_id = CASE WHEN used - 1 <= 0 THEN NULL ELSE team_id END,
          tags = CASE WHEN used - 1 <= 0 THEN NULL ELSE tags END
        WHERE id = ?
      `, [lockedRoom.id]);

      // 4. 记录台账与操作日志
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
        detail: JSON.stringify({ person_id: lockedPerson.id, room_id: lockedRoom.id }),
        created_at: now,
      });

      return { roomNo: lockedRoom.room_no };
    });

    return result;
  }
}

module.exports = CheckoutService;