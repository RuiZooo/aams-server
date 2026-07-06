'use strict';

const Service = require('egg').Service;

class SchedulerService extends Service {

  async pickRoom(rooms, person) {

    // =========================
    // 🧠 动态策略
    // =========================
    const strategy = await this.service.strategy.getActiveStrategy();

    const {
      team_match_weight,
      empty_room_weight,
      utilization_weight,
      fragment_penalty,
      gender_strict,
    } = strategy;

    const candidates = rooms
      .filter(r => {

        // 性别限制（可配置）
        if (gender_strict && r.gender !== person.gender) {
          return false;
        }

        return r.status === 'active' && r.used < r.capacity;
      })
      .map(room => {

        let score = 0;

        // =====================
        // team 权重
        // =====================
        if (room.team_id === person.team_id) {
          score += team_match_weight;
        } else if (!room.team_id) {
          score += empty_room_weight;
        } else {
          score -= 20;
        }

        // =====================
        // 利用率权重
        // =====================
        const ratio = (room.capacity - room.used) / room.capacity;
        score += ratio * utilization_weight;

        // =====================
        // 碎片惩罚
        // =====================
        if (room.used === 1) {
          score += fragment_penalty;
        }

        return {
          room,
          score,
        };
      });

    if (!candidates.length) return null;

    candidates.sort((a, b) => b.score - a.score);

    return candidates[0].room;
  }
}

module.exports = SchedulerService;
