'use strict';
const { testDatabase } = require('./helpers');

const db = testDatabase('inspections');
beforeAll(() => db.start());
afterAll(() => db.stop());

/** Checks a room out, gives it to a housekeeper, starts and finishes the clean; the assignment id. */
async function cleaned(room, housekeeper) {
  await db.api().post('/checkouts').send({ room, at: '2026-09-28T10:40:00Z' });
  const id = (await db.api().post('/assignments').send({ room, housekeeper })).body.assignmentId;
  await db.api().post(`/assignments/${id}/start`);
  await db.api().post(`/assignments/${id}/finish`);
  return id;
}

test('a room already given to Sunita is a 409 already-assigned that names her', async () => {
  await db.api().post('/checkouts').send({ room: '301', at: '2026-09-28T10:40:00Z' });
  await db.api().post('/assignments').send({ room: '301', housekeeper: 'HK03' });

  const res = await db.api().post('/assignments').send({ room: '301', housekeeper: 'HK04' });

  expect(res.status).toBe(409);
  expect(res.body.type).toBe('/errors/already-assigned');
  expect(res.body.assignedTo).toBe('Sunita');
});

test('inspecting a room that is still occupied is a 409 step-skipped', async () => {
  const res = await db.api().post('/inspections').send({ room: '302', inspector: 'HK01', result: 'pass' });

  expect(res.status).toBe(409);
  expect(res.body.type).toBe('/errors/step-skipped');
  expect(res.body.needs).toBe('checkout');
});

test('the cleaner may not inspect her own room', async () => {
  await cleaned('214', 'HK03');

  const res = await db.api().post('/inspections').send({ room: '214', inspector: 'HK03', result: 'pass' });

  expect(res.status).toBe(409);
  expect(res.body.type).toBe('/errors/self-inspection');
});

test('a failed inspection sends the room back to dirty; a pass makes it ready', async () => {
  await cleaned('215', 'HK04');

  const failed = await db.api().post('/inspections').send({ room: '215', inspector: 'HK01', result: 'fail' });
  await cleaned('213', 'HK05');
  const passed = await db.api().post('/inspections').send({ room: '213', inspector: 'HK01', result: 'pass' });

  expect(failed.body.state).toBe('dirty');
  expect(passed.body.state).toBe('ready');
  expect((await db.api().get('/properties/harbour-view/rooms/213')).body.state).toBe('ready');
});
