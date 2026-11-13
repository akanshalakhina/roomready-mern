'use strict';
const { testDatabase } = require('./helpers');
const assignmentRepository = require('../src/assignments/repository');

const db = testDatabase('readiness');
beforeAll(() => db.start());
afterAll(() => db.stop());

/** Checks a room out (the next guest due at arrivalAt), and has HK03 clean it, ready for inspection. */
async function cleaned(room, arrivalAt) {
  await db.api().post('/checkouts').send({ room, at: '2026-09-28T10:00:00Z', arrivalAt });
  const id = (await db.api().post('/assignments').send({ room, housekeeper: 'HK03' })).body.assignmentId;
  await db.api().post(`/assignments/${id}/start`);
  await db.api().post(`/assignments/${id}/finish`);
}

test('a pass at 10:40 for a guest due at 11:20 is ready with 40 minutes of margin', async () => {
  await cleaned('214', '2026-09-28T11:20:00Z');

  const res = await db.api().post('/inspections').send({ room: '214', inspector: 'HK01', result: 'pass' });

  expect(res.status).toBe(201);
  expect(res.body.state).toBe('ready');
  expect(res.body.marginMinutes).toBe(40);
});

test('when closing the assignment fails, the pass is a 500 and the room still waits for inspection', async () => {
  await cleaned('215', '2026-09-28T11:20:00Z');
  jest.spyOn(assignmentRepository, 'stamp').mockRejectedValueOnce(new Error('the assignment write failed'));

  const res = await db.api().post('/inspections').send({ room: '215', inspector: 'HK01', result: 'pass' });

  expect(res.status).toBe(500);
  expect((await db.api().get('/properties/harbour-view/rooms/215')).body.state).toBe('toinspect');
});

test('with no arrival known the margin is null', async () => {
  await cleaned('213');

  const res = await db.api().post('/inspections').send({ room: '213', inspector: 'HK01', result: 'pass' });

  expect(res.body.marginMinutes).toBeNull();
});
