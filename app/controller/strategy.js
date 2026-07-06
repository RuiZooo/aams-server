'use strict';

const Controller = require('egg').Controller;

class StrategyController extends Controller {

  async get() {
    const { ctx } = this;
    ctx.body = await ctx.service.strategy.getActiveStrategy();
  }
}

module.exports = StrategyController;
