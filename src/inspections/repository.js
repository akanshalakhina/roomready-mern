'use strict';
const mongoose = require('mongoose');
const { Stay } = require('../rooms/repository');

const Inspection = mongoose.model('Inspection', new mongoose.Schema({
  propertyId: { type: String, required: true },
  roomId: { type: String, required: true },
  assignmentId: { type: String, required: true },
  inspectionId: { type: String, required: true, unique: true },
  inspectorId: { type: String, required: true },
  result: { type: String, enum: ['pass', 'fail'], required: true },
  inspectedAt: { type: Date, required: true },
}, { collection: 'inspections' }));

/** The next inspection id in the property: 'IN' and a number of at least three digits, IN001 first. */
async function nextId(propertyId) {
  const count = await Inspection.countDocuments({ propertyId });
  return `IN${String(count + 1).padStart(3, '0')}`;
}

async function insert(inspection, session) {
  await Inspection.create([inspection], { session });
}

/** The room is ready for the next guest: when, and how many minutes before the arrival (stored, never recomputed). */
async function markReady(stayId, { readyAt, marginMinutes }, session) {
  await Stay.updateOne({ stayId }, { $set: { readyAt, marginMinutes } }, { session });
}

module.exports = { nextId, insert, markReady };
