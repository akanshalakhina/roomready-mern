'use strict';
const express = require('express');
const { z } = require('zod');
const { parse } = require('../validate');

const inspectBody = z.object({
  room: z.string().min(1),
  inspector: z.string().min(1),
  result: z.enum(['pass', 'fail']),
});

function makeInspectionRouter(service) {
  const router = express.Router();

  router.post('/inspections', async (req, res) => {
    res.status(201).json(await service.inspect(parse(inspectBody, req.body)));
  });

  return router;
}

module.exports = { makeInspectionRouter };
