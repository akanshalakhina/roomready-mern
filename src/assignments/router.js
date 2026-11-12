'use strict';
const express = require('express');
const { z } = require('zod');
const { parse } = require('../validate');

const assignBody = z.object({
  room: z.string().min(1),
  housekeeper: z.string().min(1),
});

function makeAssignmentRouter(service) {
  const router = express.Router();

  router.post('/assignments', async (req, res) => {
    res.status(201).json(await service.assign(parse(assignBody, req.body)));
  });

  router.post('/assignments/:assignmentId/start', async (req, res) => {
    res.json(await service.start(req.params.assignmentId));
  });

  router.post('/assignments/:assignmentId/finish', async (req, res) => {
    res.json(await service.finish(req.params.assignmentId));
  });

  return router;
}

module.exports = { makeAssignmentRouter };
