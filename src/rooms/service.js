'use strict';
const { NoSuchProperty, NoSuchRoom } = require('../errors');
const { stateOf, since } = require('./state');

/** Each room's current stay, that stay's open assignment, and whether an inspection of that stay passed. */
async function whereAre({ repository, assignments, inspections }, property, rooms) {
  const stays = await repository.currentStays(property, rooms.map((r) => r.no));
  const stayIds = [...stays.values()].map((st) => st.stayId);
  const open = await assignments.openForStays(property, stayIds);
  const all = await assignments.ofStays(property, stayIds);
  const passed = await inspections.passedAssignments(property, all.map((a) => a.assignmentId));
  const passedStays = new Set(all.filter((a) => passed.has(a.assignmentId)).map((a) => a.stayId));
  return rooms.map((r) => {
    const stay = stays.get(r.no);
    const assignment = (stay && open.get(stay.stayId)) || null;
    return { roomDoc: r, stay, assignment, passed: Boolean(stay && passedStays.has(stay.stayId)) };
  });
}

function makeRoomService({ repository, assignments, inspections, clock }) {
  const repos = { repository, assignments, inspections };

  async function requireProperty(property) {
    if (!(await repository.propertyExists(property))) throw new NoSuchProperty(property);
  }

  /** The rooms as the board shows them: who is on each and since when (whole minutes, by the clock). */
  async function shapeAll(property, rooms) {
    const names = new Map((await repository.housekeepersOf(property)).map((h) => [h.id, h.name]));
    return (await whereAre(repos, property, rooms)).map(({ roomDoc, stay, assignment, passed }) => {
      const state = stateOf(roomDoc, stay, assignment, passed);
      const shaped = { no: roomDoc.no, floor: roomDoc.floor, type: roomDoc.type, state, assignedTo: null };
      const from = since(state, assignment);
      if (!from) return shaped;
      const sinceMinutes = Math.floor((clock.now().getTime() - from.getTime()) / 60000);
      return { ...shaped, assignedTo: names.get(assignment.housekeeperId), sinceMinutes };
    });
  }

  /** The board, optionally one floor, state and/or type; `ready` and `dirty` count the rooms shown. */
  async function board(property, { floor, state, type } = {}) {
    await requireProperty(property);
    const rooms = (await shapeAll(property, await repository.roomsOf(property)))
      .filter((r) => (!floor || r.floor === floor) && (!state || r.state === state) && (!type || r.type === type));
    const count = (s) => rooms.filter((r) => r.state === s).length;
    return { property, ready: count('ready'), dirty: count('dirty'), rooms };
  }

  async function room(property, no) {
    await requireProperty(property);
    const found = await repository.room(property, no);
    if (!found) throw new NoSuchRoom(no);
    return (await shapeAll(property, [found]))[0];
  }

  /** The housekeepers, each with the room number of her open assignment, or null. */
  async function housekeepers(property) {
    await requireProperty(property);
    const open = new Map((await whereAre(repos, property, await repository.roomsOf(property)))
      .filter((w) => w.assignment).map((w) => [w.assignment.housekeeperId, w.roomDoc.no]));
    const list = await repository.housekeepersOf(property);
    return { housekeepers: list.map((h) => ({ id: h.id, name: h.name, openAssignment: open.get(h.id) || null })) };
  }

  return { board, room, housekeepers };
}

module.exports = { makeRoomService };
