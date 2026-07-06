'use strict';

const Service = require('egg').Service;

function hasValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function toPositiveInt(value, fallback, max) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

class OperationLogService extends Service {

  async create(action, detail, operator = 'system') {
    try {
      await this.app.mysql.insert('operation_logs', {
        operator,
        action,
        detail: typeof detail === 'string' ? detail : JSON.stringify(detail || {}),
        created_at: new Date(),
      });
    } catch (err) {
      this.ctx.logger.warn('[operationLog] write failed: %s', err.message);
    }
  }

  async list(query = {}) {
    const { app } = this;
    const page = toPositiveInt(query.page, 1, 100000);
    const pageSize = toPositiveInt(query.pageSize, 20, 100);
    const offset = (page - 1) * pageSize;

    const where = [];
    const params = [];

    if (hasValue(query.keyword)) {
      const keyword = `%${String(query.keyword).trim()}%`;
      where.push('(operator LIKE ? OR action LIKE ? OR detail LIKE ?)');
      params.push(keyword, keyword, keyword);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const countRows = await app.mysql.query(
      `SELECT COUNT(*) AS total FROM operation_logs ${whereSql}`,
      params
    );
    const rows = await app.mysql.query(
      `SELECT * FROM operation_logs ${whereSql} ORDER BY created_at DESC, id DESC LIMIT ?, ?`,
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
}

module.exports = OperationLogService;
