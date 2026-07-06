'use strict';

const Service = require('egg').Service;

class RoomTransferService extends Service {
  /**
   * 换房核心逻辑
   * 包含：死锁规避、旧房洗白、新房二次染色、流水记录
   */
  async transfer(data) {
    const { app } = this;
    const personId = Number(data.personId || data.person_id);
    const targetRoomId = Number(data.targetRoomId || data.target_room_id);

    const person = await app.mysql.get('persons', { id: personId, status: 'staying' });
    if (!person) throw new Error('人员不存在或已退房');

    if (person.room_id === targetRoomId) {
      throw new Error('该人员已经在目标房间中，无需更换');
    }

    const result = await app.mysql.beginTransactionScope(async conn => {
      // 1. 防死锁策略：始终先锁 ID 较小的房间，再锁 ID 较大的房间
      // 如果两个并发请求互相转移，保证它们申请锁的顺序一致，彻底杜绝死锁。
      const minId = Math.min(person.room_id, targetRoomId);
      const maxId = Math.max(person.room_id, targetRoomId);

      await conn.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [minId]);
      await conn.query('SELECT * FROM rooms WHERE id = ? FOR UPDATE', [maxId]);

      // 重新读取锁定后的房间最新状态
      const lockedOldRooms = await conn.query('SELECT * FROM rooms WHERE id = ?', [person.room_id]);
      const lockedTargetRooms = await conn.query('SELECT * FROM rooms WHERE id = ?', [targetRoomId]);

      const lockedOldRoom = lockedOldRooms[0];
      const lockedTargetRoom = lockedTargetRooms[0];

      if (!lockedOldRoom || !lockedTargetRoom) {
        throw new Error('房间信息异常');
      }

      // 2. 目标房间前置校验 (容量与性别红线)
      if (lockedTargetRoom.status !== 'active' || lockedTargetRoom.used >= lockedTargetRoom.capacity) {
        throw new Error('目标房间已满或不可用');
      }
      if (lockedTargetRoom.gender !== 'mixed' && lockedTargetRoom.gender !== person.gender) {
        throw new Error('性别不符，无法换入目标房间');
      }

      const now = new Date();

      // 3. 处理旧房 (扣减床位 + 洗白逻辑)
      await conn.query(`
        UPDATE rooms SET
          used = GREATEST(used - 1, 0),
          gender = CASE WHEN used - 1 <= 0 THEN 'mixed' ELSE gender END,
          team_id = CASE WHEN used - 1 <= 0 THEN NULL ELSE team_id END,
          tags = CASE WHEN used - 1 <= 0 THEN NULL ELSE tags END
        WHERE id = ?
      `, [lockedOldRoom.id]);

      // 4. 处理新房 (增加床位 + 染色逻辑)
      // 注意：新房有可能是纯空房，如果是纯空房，直接继承该人员当前的性别和团队信息
      await conn.query(`
        UPDATE rooms SET
          gender = CASE WHEN used = 0 THEN ? ELSE gender END,
          team_id = CASE WHEN used = 0 THEN ? ELSE team_id END,
          used = used + 1
        WHERE id = ?
      `, [person.gender, person.team_id, lockedTargetRoom.id]);

      // 5. 更新人员档案
      await conn.update('persons', {
        room_id: lockedTargetRoom.id,
      }, { where: { id: person.id } });

      // 6. 记录转移明细台账
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
        remark: `从 ${lockedOldRoom.room_no} 更换至 ${lockedTargetRoom.room_no}`,
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

      return {
        oldRoomNo: lockedOldRoom.room_no,
        newRoomNo: lockedTargetRoom.room_no,
      };
    });

    return result;
  }
}

module.exports = RoomTransferService;