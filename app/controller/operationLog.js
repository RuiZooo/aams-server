'use strict';

const Controller = require('egg').Controller;

class OperationLogController extends Controller {

  async list() {
    const { ctx } = this;
    ctx.body = await ctx.service.operationLog.list(ctx.query);
  }
}

module.exports = OperationLogController;
