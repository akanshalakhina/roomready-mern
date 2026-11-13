'use strict';
const { NoSuchRoom, NoSuchHousekeeper, StepSkipped, SelfInspection } = require('../errors');
const { stateOf, NEEDS } = require('../rooms/state');
const { wholeSecond, iso } = require('../time');

const PROPERTY = 'harbour-view';

/** The room waiting for inspection: its stay and open assignment, or a refusal saying where it is instead. */
async function waitingRoom({ rooms, assignments }, no) {
  const room = await rooms.room(PROPERTY, no);
  if (!room) throw new NoSuchRoom(no);
  const stay = await rooms.currentStay(PROPERTY, no);
  const open = stay ? (await assignments.openForStays(PROPERTY, [stay.stayId])).get(stay.stayId) || null : null;
  const state = stateOf(room, stay, open);
  if (state !== 'toinspect') throw new StepSkipped(state, NEEDS[state]);
  return { stay, assignment: open };
}

/** Whole minutes from ready to the guest's arrival (negative when late); null when no arrival is known. */
function marginOf(readyAt, arrivalAt) {
  return arrivalAt ? Math.round((arrivalAt.getTime() - readyAt.getTime()) / 60000) : null;
}

function makeInspectionService({ inspections, assignments, rooms, clock, inTransaction }) {
  /**
   * Somebody other than the cleaner inspects a room waiting for inspection. In one transaction: the inspection is
   * recorded, a pass stamps the stay ready with its margin before arrival, and the assignment is closed. A fail makes
   * the room dirty again, for a new assignment.
   */
  async function inspect({ room: no, inspector: inspectorId, result }) {
    const { stay, assignment } = await waitingRoom({ rooms, assignments }, no);
    const inspector = await rooms.housekeeper(PROPERTY, inspectorId);
    if (!inspector) throw new NoSuchHousekeeper(inspectorId);
    if (inspectorId === assignment.housekeeperId) throw new SelfInspection();
    const inspectedAt = wholeSecond(clock.now());
    const inspectionId = await inspections.nextId(PROPERTY);
    const marginMinutes = marginOf(inspectedAt, stay.arrivalAt);
    await inTransaction(async (session) => {
      await inspections.insert({
        propertyId: PROPERTY, roomId: no, assignmentId: assignment.assignmentId, inspectionId, inspectorId, result, inspectedAt,
      }, session);
      if (result === 'pass') await inspections.markReady(stay.stayId, { readyAt: inspectedAt, marginMinutes }, session);
      await assignments.stamp(assignment.assignmentId, { closedAt: inspectedAt }, session);
    });
    const cleaner = await rooms.housekeeper(PROPERTY, assignment.housekeeperId);
    const out = { inspectionId, room: no, cleanedBy: cleaner.name, inspectedBy: inspector.name, result };
    if (result === 'fail') return { ...out, state: 'dirty' };
    return { ...out, state: 'ready', readyAt: iso(inspectedAt), arrivalAt: stay.arrivalAt && iso(stay.arrivalAt), marginMinutes };
  }

  return { inspect };
}

module.exports = { makeInspectionService };
