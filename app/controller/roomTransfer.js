/*
 * @Author: RuiZZZ 2372456234@qq.com
 * @Date: 2026-07-06 18:36:41
 * @LastEditors: RuiZZZ 2372456234@qq.com
 * @LastEditTime: 2026-07-06 19:30:53
 * @FilePath: \aams-server\app\controller\roomTransfer.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
'use strict';

const Controller = require('egg').Controller;

class RoomTransferController extends Controller {
  async transfer() {
    const { ctx } = this;
    const body = ctx.request.body;
    
    const personId = body.personId || body.person_id;
    const targetRoomId = body.targetRoomId || body.target_room_id;

    if (!personId || !targetRoomId) {
      ctx.body = { code: 400, message: '人员ID和目标房间ID不能为空', data: null };
      return;
    }

    const result = await ctx.service.roomTransfer.transfer({
      personId,
      targetRoomId,
    });

    ctx.body = {
      code: 200,
      message: '换房成功',
      data: result,
    };
  }
}

module.exports = RoomTransferController;