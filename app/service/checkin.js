'use strict';

const Service = require('egg').Service;

class CheckinService extends Service {
  /**
   * 核心：入住分配防重与四级漏斗引擎
   */
  async allocateAndCheckin(data) {
    const { app, ctx } = this;
    const { name, phone, gender, expectedCheckoutTime } = data;
    // 兼容驼峰和下划线
    const teamId = data.teamId || data.team_id || null;
    const subTeamTag = data.subTeam || data.tags || null; 

    // ==========================================
    // Step -1: 幂等性校验（防重复提交，无锁极速返回）
    // ==========================================
    const existPerson = await app.mysql.get('persons', { phone, status: 'staying' });
    if (existPerson) {
      const room = await app.mysql.get('rooms', { id: existPerson.room_id });
      return {
        isNewAllocation: false, // 标识为重复查询
        person: existPerson,
        room,
      };
    }

    // ==========================================
    // 开启数据库事务与行级悲观锁 (FOR UPDATE)
    // ==========================================
    const result = await app.mysql.beginTransactionScope(async conn => {
      let targetRoom = null;
      let matchLevel = 0;

      // ----------------------------------------
      // 第一级：完美匹配本小组房 (team_id 和 tags 完全匹配)
      // ----------------------------------------
      if (teamId && subTeamTag) {
        const step1Rooms = await conn.query(`
          SELECT * FROM rooms 
          WHERE status = 'active' AND capacity > used AND gender IN (?, 'mixed')
            AND team_id = ? AND tags = ?
          LIMIT 1 FOR UPDATE
        `, [gender, teamId, subTeamTag]);
        
        if (step1Rooms.length > 0) {
          targetRoom = step1Rooms[0];
          matchLevel = 1;
        }
      }

      // ----------------------------------------
      // 第二级：开启纯空房 (触发染色)
      // ----------------------------------------
      if (!targetRoom) {
        const step2Rooms = await conn.query(`
          SELECT * FROM rooms 
          WHERE status = 'active' AND used = 0 AND gender = 'mixed' AND team_id IS NULL
          LIMIT 1 FOR UPDATE
        `);
        
        if (step2Rooms.length > 0) {
          targetRoom = step2Rooms[0];
          matchLevel = 2;
        }
      }

      // ----------------------------------------
      // 第三级：大团队内小组混住
      // ----------------------------------------
      if (!targetRoom && teamId) {
        const step3Rooms = await conn.query(`
          SELECT * FROM rooms 
          WHERE status = 'active' AND capacity > used AND gender IN (?, 'mixed')
            AND team_id = ?
          LIMIT 1 FOR UPDATE
        `, [gender, teamId]);
        
        if (step3Rooms.length > 0) {
          targetRoom = step3Rooms[0];
          matchLevel = 3;
        }
      }

      // ----------------------------------------
      // 第四级：无团队全局混住
      // ----------------------------------------
      if (!targetRoom) {
        const step4Rooms = await conn.query(`
          SELECT * FROM rooms 
          WHERE status = 'active' AND capacity > used AND gender IN (?, 'mixed')
            AND team_id IS NULL AND used > 0
          LIMIT 1 FOR UPDATE
        `, [gender]);
        
        if (step4Rooms.length > 0) {
          targetRoom = step4Rooms[0];
          matchLevel = 4;
        }
      }

      // ----------------------------------------
      // 终局研判：资源是否耗尽
      // ----------------------------------------
      if (!targetRoom) {
        // 抛出错误后，会被最外层的 errorHandler 中间件拦截并返回给前端
        throw new Error('当前资源已彻底耗尽，暂无可用房源分配');
      }

      // ==========================================
      // 执行写入与染色逻辑
      // ==========================================
      const now = new Date();
      
      // 1. 房间染色与床位扣减
      await conn.query(`
        UPDATE rooms SET 
          gender = ?, 
          team_id = CASE WHEN used = 0 THEN ? ELSE team_id END,
          tags = CASE WHEN used = 0 THEN ? ELSE tags END,
          used = used + 1
        WHERE id = ?
      `, [gender, teamId, subTeamTag, targetRoom.id]);

      // 2. 写入人员表
      const insertPerson = await conn.insert('persons', {
        name, phone, gender,
        team_id: teamId,
        room_id: targetRoom.id,
        status: 'staying',
        checkin_time: now,
        expected_checkout_time: expectedCheckoutTime ? new Date(expectedCheckoutTime) : null,
        remark: data.remark || null,
      });

      const newPersonId = insertPerson.insertId;

      // 3. 记录流水与账单
      await conn.insert('stay_records', {
        person_id: newPersonId,
        room_id: targetRoom.id,
        action_type: 'checkin',
        checkin_time: now,
      });

      await conn.insert('billing_ledger', {
        person_id: newPersonId,
        room_id: targetRoom.id,
        type: 'checkin',
        amount: 0,
        remark: `自动分配(漏斗层级:${matchLevel})`,
        status: 'pending',
        created_at: now,
      });

      await conn.insert('operation_logs', {
        operator: 'system',
        action: 'person.checkin.auto',
        detail: JSON.stringify({ person_id: newPersonId, room_id: targetRoom.id, matchLevel }),
        created_at: now,
      });

      // 返回最新数据供前台展示
      targetRoom.used += 1; // 手动更新内存对象用于返回
      if (matchLevel === 2) { // 若是纯空房，手动更新颜色与标签属性用于返回
        targetRoom.gender = gender;
        targetRoom.team_id = teamId;
        targetRoom.tags = subTeamTag;
      }

      return {
        isNewAllocation: true,
        matchLevel,
        person: { id: newPersonId, name, phone, gender, team_id: teamId },
        room: targetRoom
      };
    });

    return result;
  }
}

module.exports = CheckinService;