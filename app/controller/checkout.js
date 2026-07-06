'use strict';

const Controller = require('egg').Controller;

class CheckoutController extends Controller {

  async checkout() {
    const { ctx } = this;
    const personId = ctx.request.body.personId || ctx.request.body.person_id;

    if (!personId) {
      ctx.body = {
        success: false,
        message: 'personId不能为空',
      };
      return;
    }

    const result = await ctx.service.checkout.checkout({
      personId,
    });

    ctx.body = result;
  }
}

module.exports = CheckoutController;
