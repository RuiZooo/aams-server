'use strict';

const Service = require('egg').Service;

const VALID_GENDERS = [ 'male', 'female' ];
const VALID_STATUS = [ 'staying', 'checkout', 'moving' ];

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

function parseDate(value) {
  if (!hasValue(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

class PersonService extends Service {

  async list(query = {}) {
    const { app } = this;
    const page = toPositiveInt(query.page, 1, 100000);
    const pageSize = toPositiveInt(query.pageSize, 20, 100);
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (hasValue(query.keyword)) {
      const keyword = `%${String(query.keyword).trim()}%`;
      where.push('(p.name LIKE ? OR p.phone LIKE ? OR r.room_no LIKE ?)');
      params.push(keyword, keyword, keyword);
    }

    if (VALID_STATUS.includes(query.status)) {
      where.push('p.status = ?');
      params.push(query.status);
    }

    if (VALID_GENDERS.includes(query.gender)) {
      where.push('p.gender = ?');
      params.push(query.gender);
    }

    if (hasValue(query.teamId) || hasValue(query.team_id)) {
      const teamId = toNullableInteger(query.teamId || query.team_id);
      if (teamId !== null) {
        where.push('p.team_id = ?');
        params.push(teamId);
      }
    }

    if (hasValue(query.roomId) || hasValue(query.room_id)) {
      const roomId = toNullableInteger(query.roomId || query.room_id);
      if (roomId !== null) {
        where.push('p.room_id = ?');
        params.push(roomId);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await app.mysql.query(
      `
        SELECT COUNT(*) AS total
        FROM persons p
        LEFT JOIN rooms r ON r.id = p.room_id
        ${whereSql}
      `,
      params
    );
    const rows = await app.mysql.query(
      `
        SELECT
          p.*,
          r.room_no,
          r.gender AS room_gender,
          r.capacity AS room_capacity,
          r.status AS room_status
        FROM persons p
        LEFT JOIN rooms r ON r.id = p.room_id
        ${whereSql}
        ORDER BY p.created_at DESC, p.id DESC
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
    const personId = toInteger(id, null);
    if (!personId) return fail('人员ID不合法');

    const persons = await app.mysql.query(
      `
        SELECT
          p.*,
          r.room_no,
          r.gender AS room_gender,
          r.capacity AS room_capacity,
          r.status AS room_status
        FROM persons p
        LEFT JOIN rooms r ON r.id = p.room_id
        WHERE p.id = ?
        LIMIT 1
      `,
      [ personId ]
    );

    if (!persons.length) return fail('人员不存在');

    const stayRecords = await app.mysql.query(
      'SELECT * FROM stay_records WHERE person_id = ? ORDER BY created_at DESC, id DESC',
      [ personId ]
    );
    const ledger = await app.mysql.query(
      'SELECT * FROM billing_ledger WHERE person_id = ? ORDER BY created_at DESC, id DESC',
      [ personId ]
    );

    return {
      success: true,
      data: {
        person: persons[0],
        stayRecords,
        ledger,
      },
    };
  }

  async update(id, data = {}) {
    const { app, ctx } = this;
    const personId = toInteger(id, null);
    if (!personId) return fail('人员ID不合法');

    const person = await app.mysql.get('persons', { id: personId });
    if (!person) return fail('人员不存在');

    const updates = {};

    if (hasValue(data.name)) updates.name = String(data.name).trim();

    if (hasValue(data.phone)) {
      const phone = String(data.phone).trim();
      const duplicate = await app.mysql.query(
        "SELECT id FROM persons WHERE phone = ? AND status = 'staying' AND id <> ? LIMIT 1",
        [ phone, personId ]
      );
      if (duplicate.length) return fail('手机号已有在住人员使用');
      updates.phone = phone;
    }

    if (hasValue(data.gender)) {
      if (!VALID_GENDERS.includes(data.gender)) return fail('性别不合法');

      if (person.status === 'staying' && person.room_id) {
        const room = await app.mysql.get('rooms', { id: person.room_id });
        if (room && room.gender !== 'mixed' && room.gender !== data.gender) {
          return fail('当前房间性别类型与人员性别不匹配');
        }
      }

      updates.gender = data.gender;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'teamId') ||
      Object.prototype.hasOwnProperty.call(data, 'team_id')) {
      const teamId = toNullableInteger(data.teamId || data.team_id);
      if ((hasValue(data.teamId) || hasValue(data.team_id)) && teamId === null) {
        return fail('团队ID不合法');
      }
      updates.team_id = teamId;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'expectedCheckoutTime') ||
      Object.prototype.hasOwnProperty.call(data, 'expected_checkout_time')) {
      const rawDate = data.expectedCheckoutTime || data.expected_checkout_time;
      const date = parseDate(rawDate);
      if (hasValue(rawDate) && !date) return fail('预计退房时间不合法');
      updates.expected_checkout_time = date;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'remark')) {
      updates.remark = hasValue(data.remark) ? String(data.remark).trim() : null;
    }

    if (!Object.keys(updates).length) {
      return await this.get(personId);
    }

    await app.mysql.update('persons', updates, {
      where: { id: personId },
    });

    await ctx.service.operationLog.create('person.update', {
      id: personId,
      updates,
    });

    return await this.get(personId);
  }
}

module.exports = PersonService;
