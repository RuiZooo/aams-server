'use strict';

const Controller = require('egg').Controller;

class CheckinController extends Controller {
  async create() {
    const result = await this.ctx.service.checkin.checkin(
      this.ctx.request.body
    );

    this.ctx.body = result;
  }
}

module.exports = CheckinController;
