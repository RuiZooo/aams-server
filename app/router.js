/*
 * @Author: RuiZZZ 2372456234@qq.com
 * @Date: 2026-07-06 18:36:41
 * @LastEditors: RuiZZZ 2372456234@qq.com
 * @LastEditTime: 2026-07-07 11:36:35
 * @FilePath: \aams-server\app\router.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/', controller.home.index);

  router.get('/health', ctx => {
    ctx.body = { ok: true, timestamp: Date.now() };
  });

  // --- 房间资源管理 CRUD ---
  router.get('/api/aams/rooms', controller.room.list);
  router.get('/api/aams/rooms/:id', controller.room.get);
  router.post('/api/aams/rooms', controller.room.create);
  router.put('/api/aams/rooms/:id', controller.room.update);
  router.delete('/api/aams/rooms/:id', controller.room.remove);

  // --- 人员与台账管理 ---
  router.get('/api/aams/persons', controller.person.list);
  router.get('/api/aams/persons/:id', controller.person.get);
  router.put('/api/aams/persons/:id', controller.person.update);

  // --- 核心入住相关 (已重构) ---
  router.post('/api/aams/checkin', controller.checkin.create);
  router.post('/api/aams/checkout', controller.checkout.checkout);
  router.post('/api/aams/transferRoom', controller.roomTransfer.transfer);

  // --- 财务与流水 ---
  router.get('/api/aams/billing/person/:id', controller.billing.getPerson);
  router.get('/api/aams/billing/team/:teamId', controller.billing.getTeam);
  router.get('/api/aams/billing/room/:roomId', controller.billing.getRoom);

  // --- 大盘控制台 ---
  router.get('/api/aams/dashboard/overview', controller.dashboard.overview);
  router.get('/api/aams/dashboard/occupancy', controller.dashboard.occupancy);
  router.get('/api/aams/dashboard/revenue', controller.dashboard.revenue);
  router.get('/api/aams/dashboard/team-rank', controller.dashboard.teamRank);
  router.get('/api/aams/dashboard/room-rank', controller.dashboard.roomRank);
  router.get('/api/aams/dashboard/rooms', controller.dashboard.roomOverview);
  router.get('/api/aams/dashboard/logs', controller.dashboard.recentLogs);
  router.get('/api/aams/operation-logs', controller.operationLog.list);

  router.get('/api/aams/teams', controller.room.getTeams);
  
  // 删除了无用的 scheduler 和 strategy 路由
};