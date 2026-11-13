'use strict';
const express = require('express');
const { inTransaction } = require('./db');
const roomRepository = require('./rooms/repository');
const { makeRoomService } = require('./rooms/service');
const { makeRoomRouter } = require('./rooms/router');
const checkoutRepository = require('./checkouts/repository');
const assignmentRepository = require('./assignments/repository');
const inspectionRepository = require('./inspections/repository');
const { makeInspectionService } = require('./inspections/service');
const { makeInspectionRouter } = require('./inspections/router');
const { makeAssignmentService } = require('./assignments/service');
const { makeAssignmentRouter } = require('./assignments/router');
const { makeCheckoutService } = require('./checkouts/service');
const { makeCheckoutRouter } = require('./checkouts/router');
const { notFound, errorHandler } = require('./errors/middleware');

/** Builds the Express app. It never connects to the database and never listens: server.js and tests do that. */
function createApp({ settings, clock }) {
  const app = express();
  const rooms = makeRoomService({ repository: roomRepository, assignments: assignmentRepository, clock });
  const assignments = makeAssignmentService({ assignments: assignmentRepository, rooms: roomRepository, clock });
  const inspections = makeInspectionService({
    inspections: inspectionRepository, assignments: assignmentRepository, rooms: roomRepository, clock, inTransaction,
  });
  const checkouts = makeCheckoutService({ checkouts: checkoutRepository, rooms: roomRepository, clock });

  app.use(express.json());
  app.use(makeRoomRouter(rooms));
  app.use(makeCheckoutRouter(checkouts));
  app.use(makeAssignmentRouter(assignments));
  app.use(makeInspectionRouter(inspections));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
