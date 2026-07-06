'use strict';

const Controller = require('egg').Controller;

class CheckoutController extends Controller {
  async checkout() {
    const { ctx } = this;
    const personId = ctx.request.body.personId || ctx.request.body.person_id;

    if (!personId) {
      ctx.body = { code: 400, message: 'personId 不能为空', data: null };
      return;
    }

    const result = await ctx.service.checkout.checkout({ personId });

    ctx.body = {
      code: 200,
      message: '退房成功',
      data: result,
    };
  }
}

module.exports = CheckoutController;