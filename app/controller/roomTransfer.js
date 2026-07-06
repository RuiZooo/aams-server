'use strict';

const Controller = require('egg').Controller;

class RoomTransferController extends Controller {

  async transfer() {
    const { ctx } = this;

    const personId = ctx.request.body.personId || ctx.request.body.person_id;
    const targetRoomId = ctx.request.body.targetRoomId || ctx.request.body.target_room_id;

    if (!personId || !targetRoomId) {
      ctx.body = {
        success: false,
        message: '参数不完整',
      };
      return;
    }

    const result = await ctx.service.roomTransfer.transfer({
      personId,
      targetRoomId,
    });

    ctx.body = result;
  }
}

module.exports = RoomTransferController;
