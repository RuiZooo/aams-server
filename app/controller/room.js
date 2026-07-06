'use strict';

const Controller = require('egg').Controller;

class RoomController extends Controller {

  async list() {
    const { ctx } = this;
    ctx.body = await ctx.service.room.list(ctx.query);
  }

  async get() {
    const { ctx } = this;
    ctx.body = await ctx.service.room.get(ctx.params.id);
  }

  async create() {
    const { ctx } = this;
    ctx.body = await ctx.service.room.create(ctx.request.body);
  }

  async update() {
    const { ctx } = this;
    ctx.body = await ctx.service.room.update(ctx.params.id, ctx.request.body);
  }

  async remove() {
    const { ctx } = this;
    ctx.body = await ctx.service.room.remove(ctx.params.id);
  }
}

module.exports = RoomController;
