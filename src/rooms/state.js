'use strict';

/**
 * A room's state, derived from where it is in the sequence - never stored. `stay` is its current stay, `assignment`
 * the open assignment of that stay (or null).
 */
function stateOf(room, stay, assignment) {
  if (room.outOfOrder) return 'out_of_order';
  if (!stay || stay.checkedOutAt === null) return 'occupied';
  if (!assignment) return 'dirty';
  if (assignment.startedAt === null) return 'assigned';
  return assignment.finishedAt === null ? 'cleaning' : 'toinspect';
}

/** The step that must come first, for each state. */
const NEEDS = {
  occupied: 'checkout', dirty: 'assign', assigned: 'start', cleaning: 'finish', toinspect: 'inspect', ready: 'checkin',
};

/** The assignment stamp each state starts from. */
const STARTS_AT = { assigned: 'assignedAt', cleaning: 'startedAt', toinspect: 'finishedAt' };

/** When the room entered its current state, for the states an assignment stamps; null for the others. */
function since(state, assignment) {
  return assignment && STARTS_AT[state] ? assignment[STARTS_AT[state]] : null;
}

module.exports = { stateOf, NEEDS, since };
