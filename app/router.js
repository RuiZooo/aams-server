'use strict';

module.exports = app => {
  const { router, controller } = app;

  router.get('/', controller.home.index);

  router.get('/health', ctx => {
    ctx.body = { ok: true };
  });

  router.get('/api/rooms', controller.room.list);
  router.get('/api/aams/rooms', controller.room.list);
  router.get('/api/aams/rooms/:id', controller.room.get);
  router.post('/api/aams/rooms', controller.room.create);
  router.put('/api/aams/rooms/:id', controller.room.update);
  router.delete('/api/aams/rooms/:id', controller.room.remove);

  router.get('/api/aams/persons', controller.person.list);
  router.get('/api/aams/persons/:id', controller.person.get);
  router.put('/api/aams/persons/:id', controller.person.update);

  router.post('/api/aams/checkin', controller.checkin.create);

  router.post('/api/aams/transferRoom', controller.roomTransfer.transfer);

  router.post('/api/aams/checkout', controller.checkout.checkout);

  router.get('/api/aams/billing/person/:id', controller.billing.getPerson);
  router.get('/api/aams/billing/team/:teamId', controller.billing.getTeam);
  router.get('/api/aams/billing/room/:roomId', controller.billing.getRoom);

  router.get('/api/aams/dashboard/overview', controller.dashboard.overview);
  router.get('/api/aams/dashboard/occupancy', controller.dashboard.occupancy);
  router.get('/api/aams/dashboard/revenue', controller.dashboard.revenue);
  router.get('/api/aams/dashboard/team-rank', controller.dashboard.teamRank);
  router.get('/api/aams/dashboard/room-rank', controller.dashboard.roomRank);
  router.get('/api/aams/dashboard/rooms', controller.dashboard.roomOverview);
  router.get('/api/aams/dashboard/logs', controller.dashboard.recentLogs);

  router.get('/api/dashboard/stats', controller.dashboard.overview);
  router.get('/api/dashboard/rooms', controller.dashboard.roomOverview);
  router.get('/api/dashboard/logs', controller.dashboard.recentLogs);

  router.get('/api/aams/operation-logs', controller.operationLog.list);

  router.get('/api/aams/strategy', controller.strategy.get);
};
