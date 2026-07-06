/*
 * @Author: RuiZZZ 2372456234@qq.com
 * @Date: 2026-07-06 18:36:41
 * @LastEditors: RuiZZZ 2372456234@qq.com
 * @LastEditTime: 2026-07-06 18:55:07
 * @FilePath: \aams-server\config\config.default.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
'use strict';

module.exports = appInfo => {
  const config = {};

  // 安全 key
  config.keys = appInfo.name + '_aams_2026';

  // 挂载全局异常处理中间件 (新增加)
  config.middleware = [ 'errorHandler' ];

  // MySQL配置
  config.mysql = {
    client: {
      host: '111.230.96.110',
      port: 3306,
      user: 'qxlp-aams',
      password: 'zr200116', // 建议生产环境使用环境变量读取
      database: 'qxlp-aams',
    },
    app: true,
    agent: false,
  };

  // 关闭 csrf
  config.security = {
    csrf: {
      enable: false,
    },
  };

  config.cors = {
    origin: '*',
    allowMethods: 'GET,POST,PUT,DELETE,OPTIONS',
  };

  return config;
};