'use strict';

const Service = require('egg').Service;

class StrategyService extends Service {

  async getActiveStrategy() {
    const { app } = this;

    const strategy = await app.mysql.get('scheduler_strategy', {
      is_active: 1,
    });

    return strategy;
  }
}

module.exports = StrategyService;
