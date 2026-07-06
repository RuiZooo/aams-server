'use strict';

const Service = require('egg').Service;

class ABSchedulerService extends Service {

  /**
   * 执行所有策略
   * @param {Array} rooms 可参与分配的房间列表
   * @param {Object} person 待入住人员信息
   */
  async runAllStrategies(rooms, person) {
    const strategies = await this.app.mysql.query(
      `
        SELECT *
        FROM scheduler_strategy
        WHERE is_active = 1
        ORDER BY priority DESC, id ASC
      `
    );

    const results = [];

    for (const strategy of strategies) {

      const candidate = await this.runSingleStrategy(
        rooms,
        person,
        strategy
      );

      if (candidate) {
        results.push({
          strategy,
          room: candidate.room,
          score: candidate.score,
        });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.strategy.priority || 0) - (a.strategy.priority || 0);
    });

    return results;
  }

  /**
   * 单策略评分
   * @param {Array} rooms 可参与分配的房间列表
   * @param {Object} person 待入住人员信息
   * @param {Object} strategy 调度策略配置
   */
  async runSingleStrategy(rooms, person, strategy) {

    const {
      team_match_weight,
      empty_room_weight,
      utilization_weight,
      fragment_penalty,
      gender_strict,
    } = strategy;

    const candidates = rooms
      .filter(r => {

        if (gender_strict && r.gender !== 'mixed' && r.gender !== person.gender) {
          return false;
        }

        return r.status === 'active' && r.used < r.capacity;
      })
      .map(room => {

        let score = 0;
        const teamId = person.team_id || person.teamId;

        if (room.team_id && teamId && room.team_id === teamId) {
          score += team_match_weight;
        } else if (!room.team_id) {
          score += empty_room_weight;
        } else {
          score -= 20;
        }

        const ratio = (room.capacity - room.used) / room.capacity;
        score += ratio * utilization_weight;

        if (room.used === 1) {
          score += fragment_penalty;
        }

        return { room, score };
      });

    if (!candidates.length) return null;

    candidates.sort((a, b) => b.score - a.score);

    return candidates[0];
  }
}

module.exports = ABSchedulerService;
