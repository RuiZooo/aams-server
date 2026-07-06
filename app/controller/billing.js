'use strict';

const Controller = require('egg').Controller;

class BillingController extends Controller {

  async getPerson() {
    const { ctx } = this;
    const id = ctx.params.id;

    const result = await ctx.service.billing.getPersonBilling(id);

    ctx.body = result;
  }

  async getTeam() {
    const { ctx } = this;
    const teamId = ctx.params.teamId;

    const result = await ctx.service.billing.getTeamBilling(teamId);

    ctx.body = result;
  }

  async getRoom() {
    const { ctx } = this;
    const roomId = ctx.params.roomId;

    const result = await ctx.service.billing.getRoomBilling(roomId);

    ctx.body = result;
  }
}

module.exports = BillingController;
