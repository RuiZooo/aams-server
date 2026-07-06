/*
 * @Author: RuiZZZ 2372456234@qq.com
 * @Date: 2026-07-06 18:36:41
 * @LastEditors: RuiZZZ 2372456234@qq.com
 * @LastEditTime: 2026-07-06 18:55:34
 * @FilePath: \aams-server\app\controller\checkin.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
'use strict';

const Controller = require('egg').Controller;

class CheckinController extends Controller {
  /**
   * 办理入住 API 入口
   * 职责：仅做参数基本校验和结果转发，绝对不写业务逻辑
   */
  async create() {
    const { ctx } = this;
    const body = ctx.request.body;

    // 基础参数拦截
    if (!body.phone || !body.name || !body.gender) {
      ctx.body = { code: 400, message: '姓名、手机号、性别为必填项', data: null };
      return;
    }

    // 调用重构后的核心分配 Service
    const result = await ctx.service.checkin.allocateAndCheckin(body);

    // 返回标准统一格式
    ctx.body = {
      code: 200,
      message: result.isNewAllocation ? '分配成功' : '您已成功登记，无需重复提交',
      data: result,
    };
  }
}

module.exports = CheckinController;
