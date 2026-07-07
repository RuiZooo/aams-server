/*
 * @Author: RuiZZZ 2372456234@qq.com
 * @Date: 2026-07-06 18:36:41
 * @LastEditors: RuiZZZ 2372456234@qq.com
 * @LastEditTime: 2026-07-07 11:31:33
 * @FilePath: \aams-server\app\controller\room.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
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

  async getTeams() {
    const { ctx } = this;
    try {
      // 使用 egg 内置的 HttpClient 发起请求到三方服务器
      const result = await ctx.curl('http://api.qxiao.group/api/org/deptList', {
        dataType: 'json', // 自动解析 JSON 响应
        timeout: 5000,    // 设置 5 秒超时，防止第三方接口卡死拖垮我们自己的服务
      });

      console.log('获取团队列表成功:', result.data);

      // 拿到三方数据后，原封不动地返回给前端
      if (result.status === 200) {
        ctx.body = result.data; 
      } else {
        ctx.status = result.status;
        ctx.body = { code: result.status, message: '第三方接口请求异常' };
      }
    } catch (error) {
      ctx.logger.error('获取团队列表失败:', error);
      ctx.status = 500;
      ctx.body = { code: 500, message: '服务器内部错误，获取团队失败' };
    }
  }
}

module.exports = RoomController;
