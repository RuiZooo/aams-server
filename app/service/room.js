'use strict';

const Service = require('egg').Service;

const VALID_GENDERS = [ 'male', 'female', 'mixed' ];
const VALID_STATUS = [ 'active', 'locked', 'disabled' ];

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function fail(message) {
  return {
    success: false,
    message,
  };
}

function toPositiveInt(value, fallback, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

function toInteger(value, fallback) {
  if (!hasValue(value)) return fallback;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function toNullableInteger(value) {
  if (!hasValue(value)) return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function pickEnum(value, enums, fallback) {
  if (!hasValue(value)) return fallback;
  return enums.includes(value) ? value : null;
}

class RoomService extends Service {

  async list(query = {}) {
    const { app } = this;
    const page = toPositiveInt(query.page, 1, 100000);
    const pageSize = toPositiveInt(query.pageSize, 20, 100);
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (hasValue(query.keyword)) {
      const keyword = `%${String(query.keyword).trim()}%`;
      where.push('(room_no LIKE ? OR tags LIKE ? OR password LIKE ?)');
      params.push(keyword, keyword, keyword);
    }

    if (VALID_STATUS.includes(query.status)) {
      where.push('status = ?');
      params.push(query.status);
    }

    if (VALID_GENDERS.includes(query.gender)) {
      where.push('gender = ?');
      params.push(query.gender);
    }

    if (hasValue(query.teamId) || hasValue(query.team_id)) {
      const teamId = toNullableInteger(query.teamId || query.team_id);
      if (teamId !== null) {
        where.push('team_id = ?');
        params.push(teamId);
      }
    }

    if ([ '1', 'true', true ].includes(query.available)) {
      where.push("status = 'active'");
      where.push('used < capacity');
    }

    if ([ '1', 'true', true ].includes(query.empty)) {
      where.push('used = 0');
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await app.mysql.query(
      `SELECT COUNT(*) AS total FROM rooms ${whereSql}`,
      params
    );
    const rows = await app.mysql.query(
      `
        SELECT
          id, room_no, gender, capacity, used, password, team_id, tags, status,
          created_at, updated_at, lock_version,
          GREATEST(capacity - used, 0) AS available_beds
        FROM rooms
        ${whereSql}
        ORDER BY room_no ASC
        LIMIT ?, ?
      `,
      [ ...params, offset, pageSize ]
    );

    return {
      success: true,
      data: {
        list: rows,
        pagination: {
          page,
          pageSize,
          total: countRows[0].total,
        },
      },
    };
  }

  async get(id) {
    const { app } = this;
    const roomId = toInteger(id, null);
    if (!roomId) return fail('房间ID不合法');

    const room = await app.mysql.get('rooms', { id: roomId });
    if (!room) return fail('房间不存在');

    const persons = await app.mysql.query(
      `
        SELECT id, name, phone, gender, team_id, checkin_time, expected_checkout_time, status, remark
        FROM persons
        WHERE room_id = ? AND status = 'staying'
        ORDER BY checkin_time DESC, id DESC
      `,
      [ roomId ]
    );

    return {
      success: true,
      data: {
        room,
        persons,
      },
    };
  }

  async create(data = {}) {
    const { app, ctx } = this;

    const roomNo = String(data.roomNo || data.room_no || '').trim();
    if (!roomNo) return fail('房间号不能为空');

    const gender = pickEnum(data.gender, VALID_GENDERS, 'mixed');
    if (!gender) return fail('房间性别类型不合法');

    const status = pickEnum(data.status, VALID_STATUS, 'active');
    if (!status) return fail('房间状态不合法');

    const capacity = toInteger(data.capacity, 8);
    if (!capacity || capacity <= 0) return fail('房间容量必须为正整数');

    const used = toInteger(data.used, 0);
    if (used === null || used < 0 || used > capacity) return fail('已用床位必须在0到容量之间');

    const teamId = toNullableInteger(data.teamId || data.team_id);
    if ((hasValue(data.teamId) || hasValue(data.team_id)) && teamId === null) {
      return fail('团队ID不合法');
    }

    const exist = await app.mysql.get('rooms', { room_no: roomNo });
    if (exist) return fail('房间号已存在');

    const insertRes = await app.mysql.insert('rooms', {
      room_no: roomNo,
      gender,
      capacity,
      used,
      password: hasValue(data.password) ? String(data.password).trim() : null,
      team_id: teamId,
      tags: hasValue(data.tags) ? String(data.tags).trim() : null,
      status,
    });

    await ctx.service.operationLog.create('room.create', {
      id: insertRes.insertId,
      room_no: roomNo,
    });

    return {
      success: true,
      data: {
        id: insertRes.insertId,
      },
    };
  }

  async update(id, data = {}) {
    const { app, ctx } = this;
    const roomId = toInteger(id, null);
    if (!roomId) return fail('房间ID不合法');

    const room = await app.mysql.get('rooms', { id: roomId });
    if (!room) return fail('房间不存在');

    const updates = {};

    if (hasValue(data.roomNo) || hasValue(data.room_no)) {
      const roomNo = String(data.roomNo || data.room_no).trim();
      if (!roomNo) return fail('房间号不能为空');

      const duplicate = await app.mysql.query(
        'SELECT id FROM rooms WHERE room_no = ? AND id <> ? LIMIT 1',
        [ roomNo, roomId ]
      );
      if (duplicate.length) return fail('房间号已存在');
      updates.room_no = roomNo;
    }

    if (hasValue(data.gender)) {
      const gender = pickEnum(data.gender, VALID_GENDERS, null);
      if (!gender) return fail('房间性别类型不合法');

      if (gender !== 'mixed' && room.used > 0) {
        const rows = await app.mysql.query(
          "SELECT DISTINCT gender FROM persons WHERE room_id = ? AND status = 'staying'",
          [ roomId ]
        );
        if (rows.some(item => item.gender !== gender)) {
          return fail('房间内已有不同性别人员，不能修改为该性别类型');
        }
      }

      updates.gender = gender;
    }

    if (hasValue(data.capacity)) {
      const capacity = toInteger(data.capacity, null);
      if (!capacity || capacity <= 0) return fail('房间容量必须为正整数');
      if (capacity < room.used) return fail('房间容量不能小于已用床位');
      updates.capacity = capacity;
    }

    if (hasValue(data.password)) updates.password = String(data.password).trim();
    if (Object.prototype.hasOwnProperty.call(data, 'tags')) {
      updates.tags = hasValue(data.tags) ? String(data.tags).trim() : null;
    }

    if (hasValue(data.status)) {
      const status = pickEnum(data.status, VALID_STATUS, null);
      if (!status) return fail('房间状态不合法');
      updates.status = status;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'teamId') ||
      Object.prototype.hasOwnProperty.call(data, 'team_id')) {
      const teamId = toNullableInteger(data.teamId || data.team_id);
      if ((hasValue(data.teamId) || hasValue(data.team_id)) && teamId === null) {
        return fail('团队ID不合法');
      }
      updates.team_id = teamId;
    }

    if (!Object.keys(updates).length) {
      return {
        success: true,
        data: room,
      };
    }

    await app.mysql.update('rooms', updates, {
      where: { id: roomId },
    });

    await ctx.service.operationLog.create('room.update', {
      id: roomId,
      updates,
    });

    return await this.get(roomId);
  }

  async remove(id) {
    const { app, ctx } = this;
    const roomId = toInteger(id, null);
    if (!roomId) return fail('房间ID不合法');

    const room = await app.mysql.get('rooms', { id: roomId });
    if (!room) return fail('房间不存在');

    const stayingRows = await app.mysql.query(
      "SELECT COUNT(*) AS total FROM persons WHERE room_id = ? AND status = 'staying'",
      [ roomId ]
    );

    if (room.used > 0 || stayingRows[0].total > 0) {
      return fail('房间仍有入住人员，不能删除');
    }

    await app.mysql.delete('rooms', { id: roomId });

    await ctx.service.operationLog.create('room.delete', {
      id: roomId,
      room_no: room.room_no,
    });

    return {
      success: true,
    };
  }
}

module.exports = RoomService;
