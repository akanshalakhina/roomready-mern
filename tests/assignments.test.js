'use strict';
const request = require('supertest');
const { createApp } = require('../src/app');
const { testDatabase } = require('./helpers');

const db = testDatabase('assignments');
beforeAll(() => db.start());
afterAll(() => db.stop());

/** Supertest on an app whose clock reads this time. */
function at(time) {
  return request(createApp({ settings: db.settings, clock: { now: () => new Date(time) } }));
}

test('assign, start, then finish 36 minutes later: the clean took 36 minutes', async () => {
  await db.api().post('/checkouts').send({ room: '214', at: '2026-09-28T10:40:00Z' });
  const assigned = await db.api().post('/assignments').send({ room: '214', housekeeper: 'HK03' });
  const id = assigned.body.assignmentId;

  await at('2026-09-28T10:55:00Z').post(`/assignments/${id}/start`);
  const finished = await at('2026-09-28T11:31:00Z').post(`/assignments/${id}/finish`);

  expect(assigned.status).toBe(201);
  expect(finished.status).toBe(200);
  expect(finished.body.cleanMinutes).toBe(36);
  expect((await db.api().get('/properties/harbour-view/rooms/214')).body.state).toBe('toinspect');
});

test('finishing a clean that never started is a 409 step-skipped that needs start', async () => {
  await db.api().post('/checkouts').send({ room: '215', at: '2026-09-28T10:40:00Z' });
  const id = (await db.api().post('/assignments').send({ room: '215', housekeeper: 'HK04' })).body.assignmentId;

  const res = await db.api().post(`/assignments/${id}/finish`);

  expect(res.status).toBe(409);
  expect(res.body.type).toBe('/errors/step-skipped');
  expect(res.body.needs).toBe('start');
});
