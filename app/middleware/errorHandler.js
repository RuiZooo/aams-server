'use strict';

/**
 * 全局统一异常处理中间件
 * 职责：捕获下游 Controller 和 Service 抛出的所有错误，防止 Node 进程崩溃，
 * 并统一包装成 { code, message, data } 格式返回给前端。
 */
module.exports = () => {
  return async function errorHandler(ctx, next) {
    try {
      await next();

      // 处理 404
      if (ctx.status === 404 && !ctx.body) {
        ctx.body = { code: 404, message: '接口不存在', data: null };
      }
    } catch (err) {
      // 触发 egg 默认的 error 事件记录日志
      ctx.app.emit('error', err, ctx);

      const status = err.status || 500;
      
      // 业务层自定义抛出的异常（例如：房源耗尽）
      let message = err.message;
      
      // 生产环境隐藏 500 的底层报错细节
      if (status === 500 && ctx.app.config.env === 'prod') {
        message = '服务器内部错误，请联系管理员';
      }

      // 统一强制返回 200 HTTP 状态码，用业务 code 标识错误（标准中后台做法）
      ctx.status = 200;
      ctx.body = {
        code: status,
        message,
        data: null,
      };
    }
  };
};