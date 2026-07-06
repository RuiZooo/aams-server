'use strict';

module.exports = appInfo => {
  const config = {};

  // 安全 key（必须有）
  config.keys = appInfo.name + '_aams_2026';

  // MySQL配置
  config.mysql = {
    client: {
      host: '111.230.96.110',
      port: 3306,
      user: 'qxlp-aams',
      password: 'zr200116',
      database: 'qxlp-aams',
    },
    app: true,
    agent: false,
  };

  // 关闭 csrf（开发阶段必须，否则接口调不通）
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
