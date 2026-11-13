'use strict';
const { NoSuchRoom, NoSuchHousekeeper, StepSkipped, SelfInspection } = require('../errors');
const { stateOf, NEEDS } = require('../rooms/state');
const { wholeSecond } = require('../time');

const PROPERTY = 'harbour-view';

/** The room waiting for inspection: its open assignment, or a refusal saying where it is instead. */
async function waitingRoom({ rooms, assignments }, no) {
  const room = await rooms.room(PROPERTY, no);
  if (!room) throw new NoSuchRoom(no);
  const stay = await rooms.currentStay(PROPERTY, no);
  const open = stay ? (await assignments.openForStays(PROPERTY, [stay.stayId])).get(stay.stayId) || null : null;
  const state = stateOf(room, stay, open);
  if (state !== 'toinspect') throw new StepSkipped(state, NEEDS[state]);
  return open;
}

function makeInspectionService({ inspections, assignments, rooms, clock }) {
  /**
   * Somebody other than the cleaner inspects a room waiting for inspection. The inspection closes the assignment: a pass
   * makes the room ready, a fail makes it dirty again, for a new assignment.
   */
  async function inspect({ room: no, inspector: inspectorId, result }) {
    const assignment = await waitingRoom({ rooms, assignments }, no);
    const inspector = await rooms.housekeeper(PROPERTY, inspectorId);
    if (!inspector) throw new NoSuchHousekeeper(inspectorId);
    if (inspectorId === assignment.housekeeperId) throw new SelfInspection();
    const inspectedAt = wholeSecond(clock.now());
    const inspectionId = await inspections.nextId(PROPERTY);
    await inspections.insert({
      propertyId: PROPERTY, roomId: no, assignmentId: assignment.assignmentId, inspectionId, inspectorId, result, inspectedAt,
    });
    await assignments.stamp(assignment.assignmentId, { closedAt: inspectedAt });
    const cleaner = await rooms.housekeeper(PROPERTY, assignment.housekeeperId);
    return {
      inspectionId, room: no, cleanedBy: cleaner.name, inspectedBy: inspector.name, result,
      state: result === 'pass' ? 'ready' : 'dirty',
    };
  }

  return { inspect };
}

module.exports = { makeInspectionService };
