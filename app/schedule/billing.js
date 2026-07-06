'use strict';

const Subscription = require('egg').Subscription;

class BillingJob extends Subscription {

  static get schedule() {
    return {
      interval: '1h',
      type: 'all',
    };
  }

  async subscribe() {
    const { app } = this;

    // =========================
    // 1. 查未结算流水
    // =========================
    const list = await app.mysql.select('billing_ledger', {
      where: { status: 'pending' },
    });

    if (!list.length) return;

    // =========================
    // 2. 按人汇总
    // =========================
    const map = new Map();

    for (const item of list) {
      if (!map.has(item.person_id)) {
        map.set(item.person_id, {
          start: item.created_at,
          end: item.created_at,
        });
      } else {
        const d = map.get(item.person_id);
        d.end = item.created_at;
      }
    }

    // =========================
    // 3. 生成最终账单
    // =========================
    for (const [ personId, val ] of map.entries()) {
      await app.mysql.insert('billing_final', {
        person_id: personId,
        total_amount: 0,
        start_time: val.start,
        end_time: val.end,
      });
    }

    // =========================
    // 4. 标记已结算
    // =========================
    await app.mysql.query(
      "UPDATE billing_ledger SET status='settled' WHERE status='pending'"
    );
  }
}

module.exports = BillingJob;
