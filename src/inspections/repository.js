'use strict';
const mongoose = require('mongoose');

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

async function insert(inspection) {
  await Inspection.create(inspection);
}

/** The assignment ids (of these) whose inspection passed. */
async function passedAssignments(propertyId, assignmentIds) {
  const passed = await Inspection.find({ propertyId, assignmentId: { $in: assignmentIds }, result: 'pass' }).lean();
  return new Set(passed.map((i) => i.assignmentId));
}

module.exports = { nextId, insert, passedAssignments };
