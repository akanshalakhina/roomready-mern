'use strict';

/** A refusal the app gives. Services throw these; the error middleware turns them into problem+json. */
class DomainError extends Error {
  constructor(status, type, title, detail) {
    super(detail);
    this.status = status;
    this.type = type;
    this.title = title;
  }

  /** Extra fields for this refusal's answer (none by default). */
  extras() {
    return {};
  }
}

class ValidationError extends DomainError {
  /** @param errors [{ field, message }] */
  constructor(errors) {
    super(400, '/errors/validation', 'Invalid request', 'The request is not valid');
    this.errors = errors;
  }

  extras() {
    return { errors: this.errors };
  }
}

class NoSuchProperty extends DomainError {
  constructor(property) {
    super(404, '/errors/no-such-property', 'No such property', `There is no property ${property}`);
  }
}

class NoSuchRoom extends DomainError {
  constructor(no) {
    super(404, '/errors/no-such-room', 'No such room', `There is no room ${no} in this property`);
  }
}

class RoomNotOccupied extends DomainError {
  constructor(no) {
    super(400, '/errors/room-not-occupied', 'Room not occupied', `Room ${no} has no guest to check out`);
  }
}

class NoSuchHousekeeper extends DomainError {
  constructor(id) {
    super(404, '/errors/no-such-housekeeper', 'No such housekeeper', `There is no housekeeper ${id}`);
  }
}

class NoSuchAssignment extends DomainError {
  constructor(id) {
    super(404, '/errors/no-such-assignment', 'No such assignment', `There is no assignment ${id}`);
  }
}

/** The room is not where this step needs it: `state` says where it is, `needs` what must happen first. */
class StepSkipped extends DomainError {
  constructor(state, needs) {
    super(409, '/errors/step-skipped', 'Step skipped', `The room is ${state}; first it needs: ${needs}`);
    this.state = state;
    this.needs = needs;
  }

  extras() {
    return { state: this.state, needs: this.needs };
  }
}

class AlreadyAssigned extends DomainError {
  constructor(assignedTo) {
    super(409, '/errors/already-assigned', 'Already assigned', `The room already has an open assignment (${assignedTo})`);
    this.assignedTo = assignedTo;
  }

  extras() {
    return { assignedTo: this.assignedTo };
  }
}

class SelfInspection extends DomainError {
  constructor() {
    super(409, '/errors/self-inspection', 'Self-inspection', 'The inspector cleaned this room; somebody else must inspect it');
  }
}

module.exports = {
  DomainError, ValidationError, NoSuchProperty, NoSuchRoom, RoomNotOccupied, NoSuchHousekeeper, NoSuchAssignment,
  StepSkipped, AlreadyAssigned, SelfInspection,
};
