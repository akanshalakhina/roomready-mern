'use strict';
const { NoSuchRoom, NoSuchHousekeeper, NoSuchAssignment, StepSkipped, AlreadyAssigned } = require('../errors');
const { stateOf, NEEDS } = require('../rooms/state');
const { wholeSecond, iso } = require('../time');

const PROPERTY = 'harbour-view';

/** Where a room is now: its current stay and its derived state. */
async function whereIs({ rooms, assignments }, no) {
  const room = await rooms.room(PROPERTY, no);
  if (!room) throw new NoSuchRoom(no);
  const stay = await rooms.currentStay(PROPERTY, no);
  const open = stay ? (await assignments.openForStays(PROPERTY, [stay.stayId])).get(stay.stayId) : null;
  return { stay, open: open || null, state: stateOf(room, stay, open || null) };
}

/** The room must be in `wanted`; otherwise the step is skipped, saying where it is and what comes first. */
function mustBe(state, wanted) {
  if (state !== wanted) throw new StepSkipped(state, NEEDS[state]);
}

function makeAssignmentService({ assignments, rooms, clock }) {
  const repos = { rooms, assignments };

  /** A dirty room is given to a housekeeper; a room that already has an open assignment is refused, naming hers. */
  async function assign({ room: no, housekeeper: housekeeperId }) {
    const { stay, open, state } = await whereIs(repos, no);
    const housekeeper = await rooms.housekeeper(PROPERTY, housekeeperId);
    if (!housekeeper) throw new NoSuchHousekeeper(housekeeperId);
    if (open) throw new AlreadyAssigned((await rooms.housekeeper(PROPERTY, open.housekeeperId)).name);
    mustBe(state, 'dirty');
    const assignedAt = wholeSecond(clock.now());
    const assignmentId = await assignments.nextId(PROPERTY);
    await assignments.insert({ propertyId: PROPERTY, roomId: no, stayId: stay.stayId, assignmentId, housekeeperId, assignedAt });
    return { assignmentId, room: no, assignedTo: housekeeper.name, assignedAt: iso(assignedAt) };
  }

  async function requireAssignment(id) {
    const assignment = await assignments.byId(PROPERTY, id);
    if (!assignment) throw new NoSuchAssignment(id);
    return assignment;
  }

  /** The housekeeper starts cleaning an assigned room. */
  async function start(id) {
    const assignment = await requireAssignment(id);
    mustBe((await whereIs(repos, assignment.roomId)).state, 'assigned');
    const startedAt = wholeSecond(clock.now());
    await assignments.stamp(id, { startedAt });
    return { assignmentId: id, startedAt: iso(startedAt) };
  }

  /** The clean is done: its duration (whole minutes, by the clock) is stored once, never recomputed. */
  async function finish(id) {
    const assignment = await requireAssignment(id);
    mustBe((await whereIs(repos, assignment.roomId)).state, 'cleaning');
    const finishedAt = wholeSecond(clock.now());
    const cleanMinutes = Math.floor((finishedAt.getTime() - assignment.startedAt.getTime()) / 60000);
    await assignments.stamp(id, { finishedAt, cleanMinutes });
    return { assignmentId: id, finishedAt: iso(finishedAt), cleanMinutes };
  }

  return { assign, start, finish };
}

module.exports = { makeAssignmentService };
