'use strict';
const express = require('express');
const request = require('supertest');
const { makeInspectionRouter } = require('../src/inspections/router');
const { errorHandler } = require('../src/errors/middleware');
const { SelfInspection } = require('../src/errors');

/** The inspection router and the error middleware alone: a fake service, no createApp, no database. */
function appWith(service) {
  const app = express();
  app.use(express.json());
  app.use(makeInspectionRouter(service));
  app.use(errorHandler);
  return app;
}

test('a SelfInspection thrown by the service becomes a 409 self-inspection problem', async () => {
  const service = { inspect: jest.fn().mockRejectedValue(new SelfInspection()) };

  const res = await request(appWith(service)).post('/inspections').send({ room: '214', inspector: 'HK03', result: 'pass' });

  expect(service.inspect).toHaveBeenCalledWith({ room: '214', inspector: 'HK03', result: 'pass' });
  expect(res.status).toBe(409);
  expect(res.headers['content-type']).toMatch(/application\/problem\+json/);
  expect(res.body.type).toBe('/errors/self-inspection');
});
