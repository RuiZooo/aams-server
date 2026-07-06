'use strict';

const Controller = require('egg').Controller;

class PersonController extends Controller {

  async list() {
    const { ctx } = this;
    ctx.body = await ctx.service.person.list(ctx.query);
  }

  async get() {
    const { ctx } = this;
    ctx.body = await ctx.service.person.get(ctx.params.id);
  }

  async update() {
    const { ctx } = this;
    ctx.body = await ctx.service.person.update(ctx.params.id, ctx.request.body);
  }
}

module.exports = PersonController;
