'use strict';

const Service = require('egg').Service;

class DashboardService extends Service {

  // =========================
  // 1. 总览
  // =========================
  async overview() {
    const { app } = this;

    const totalPersons = await app.mysql.query(
      'SELECT COUNT(*) as count FROM persons'
    );

    const staying = await app.mysql.query(
      "SELECT COUNT(*) as count FROM persons WHERE status='staying'"
    );

    const rooms = await app.mysql.query(
      'SELECT COUNT(*) as count FROM rooms'
    );

    const usedRooms = await app.mysql.query(
      'SELECT COUNT(*) as count FROM rooms WHERE used > 0'
    );

    const bedRows = await app.mysql.query(
      'SELECT SUM(capacity) as totalBeds, SUM(used) as usedBeds FROM rooms'
    );

    const todayCheckin = await app.mysql.query(
      'SELECT COUNT(*) as count FROM persons WHERE DATE(checkin_time) = CURDATE()'
    );

    const totalBeds = Number(bedRows[0].totalBeds || 0);
    const usedBeds = Number(bedRows[0].usedBeds || 0);

    return {
      success: true,
      data: {
        totalPersons: totalPersons[0].count,
        staying: staying[0].count,
        totalRooms: rooms[0].count,
        usedRooms: usedRooms[0].count,
        totalBeds,
        usedBeds,
        occupied: usedBeds,
        freeBeds: Math.max(totalBeds - usedBeds, 0),
        todayCheckin: todayCheckin[0].count,
      },
    };
  }

  // =========================
  // 2. 入住率
  // =========================
  async occupancy() {
    const { app } = this;

    const roomTotal = await app.mysql.query('SELECT COUNT(*) as c FROM rooms');
    const roomUsed = await app.mysql.query('SELECT COUNT(*) as c FROM rooms WHERE used > 0');
    const beds = await app.mysql.query('SELECT SUM(capacity) as total, SUM(used) as used FROM rooms');

    const roomRate = roomTotal[0].c === 0 ? 0 : roomUsed[0].c / roomTotal[0].c;
    const totalBeds = Number(beds[0].total || 0);
    const usedBeds = Number(beds[0].used || 0);
    const bedRate = totalBeds === 0 ? 0 : usedBeds / totalBeds;

    return {
      success: true,
      data: {
        occupancyRate: bedRate,
        bedOccupancyRate: bedRate,
        roomOccupancyRate: roomRate,
      },
    };
  }

  // =========================
  // 3. 收入统计（基于 final）
  // =========================
  async revenue() {
    const { app } = this;

    const res = await app.mysql.query(
      'SELECT SUM(total_amount) as total FROM billing_final'
    );

    return {
      success: true,
      data: {
        totalRevenue: res[0].total || 0,
      },
    };
  }

  // =========================
  // 4. team排行
  // =========================
  async teamRank() {
    const { app } = this;

    const rows = await app.mysql.query(`
      SELECT p.team_id, COUNT(*) as count
      FROM persons p
      WHERE p.status = 'staying'
      GROUP BY p.team_id
      ORDER BY count DESC
    `);

    return {
      success: true,
      data: rows,
    };
  }

  // =========================
  // 5. 房间排行
  // =========================
  async roomRank() {
    const { app } = this;

    const rows = await app.mysql.query(`
      SELECT l.room_id, r.room_no, COUNT(*) as usage_count
      FROM billing_ledger l
      LEFT JOIN rooms r ON r.id = l.room_id
      GROUP BY l.room_id, r.room_no
      ORDER BY usage_count DESC
    `);

    return {
      success: true,
      data: rows,
    };
  }

  async roomOverview(query = {}) {
    const { app } = this;
    const limit = Math.min(Math.max(Number(query.limit) || 60, 1), 200);

    const rows = await app.mysql.query(
      `
        SELECT
          id,
          room_no AS roomNo,
          room_no,
          gender,
          capacity,
          used,
          GREATEST(capacity - used, 0) AS freeBeds,
          status,
          team_id
        FROM rooms
        ORDER BY room_no ASC
        LIMIT ?
      `,
      [ limit ]
    );

    return {
      success: true,
      data: rows,
    };
  }

  async recentLogs(query = {}) {
    const { app } = this;
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);

    const rows = await app.mysql.query(
      `
        SELECT id, operator, action, detail AS message, created_at
        FROM operation_logs
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `,
      [ limit ]
    );

    return {
      success: true,
      data: rows,
    };
  }
}

module.exports = DashboardService;
