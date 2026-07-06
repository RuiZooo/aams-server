'use strict';

const Controller = require('egg').Controller;

class DashboardController extends Controller {

  async overview() {
    const { ctx } = this;
    ctx.body = await ctx.service.dashboard.overview();
  }

  async occupancy() {
    const { ctx } = this;
    ctx.body = await ctx.service.dashboard.occupancy();
  }

  async revenue() {
    const { ctx } = this;
    ctx.body = await ctx.service.dashboard.revenue();
  }

  async teamRank() {
    const { ctx } = this;
    ctx.body = await ctx.service.dashboard.teamRank();
  }

  async roomRank() {
    const { ctx } = this;
    ctx.body = await ctx.service.dashboard.roomRank();
  }

  async roomOverview() {
    const { ctx } = this;
    ctx.body = await ctx.service.dashboard.roomOverview(ctx.query);
  }

  async recentLogs() {
    const { ctx } = this;
    ctx.body = await ctx.service.dashboard.recentLogs(ctx.query);
  }
}

module.exports = DashboardController;
