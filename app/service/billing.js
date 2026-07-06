'use strict';

const Service = require('egg').Service;

class BillingService extends Service {

  // =========================
  // 1. 个人账单
  // =========================
  async getPersonBilling(personId) {
    const { app } = this;

    const ledger = await app.mysql.select('billing_ledger', {
      where: { person_id: personId },
    });

    const final = await app.mysql.select('billing_final', {
      where: { person_id: personId },
    });

    return {
      success: true,
      data: {
        ledger,
        final,
      },
    };
  }

  // =========================
  // 2. 团队账单
  // =========================
  async getTeamBilling(teamId) {
    const { app } = this;

    const persons = await app.mysql.select('persons', {
      where: { team_id: teamId },
    });

    const personIds = persons.map(p => p.id);

    if (!personIds.length) {
      return {
        success: true,
        data: [],
      };
    }

    const ledger = await app.mysql.query(
      'SELECT * FROM billing_ledger WHERE person_id IN (?)',
      [ personIds ]
    );

    return {
      success: true,
      data: {
        persons,
        ledger,
      },
    };
  }

  // =========================
  // 3. 房间收益
  // =========================
  async getRoomBilling(roomId) {
    const { app } = this;

    const ledger = await app.mysql.select('billing_ledger', {
      where: { room_id: roomId },
    });

    const income = await app.mysql.query(
      'SELECT COUNT(*) as count FROM billing_ledger WHERE room_id = ?',
      [ roomId ]
    );

    return {
      success: true,
      data: {
        ledger,
        usageCount: income[0].count,
      },
    };
  }
}

module.exports = BillingService;
