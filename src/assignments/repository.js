'use strict';
const mongoose = require('mongoose');

const Assignment = mongoose.model('Assignment', new mongoose.Schema({
  propertyId: { type: String, required: true },
  roomId: { type: String, required: true },
  stayId: { type: String, required: true },
  assignmentId: { type: String, required: true, unique: true },
  housekeeperId: { type: String, required: true },
  assignedAt: { type: Date, required: true },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
  cleanMinutes: { type: Number, default: null },
  closedAt: { type: Date, default: null },
}, { collection: 'assignments' }));

/** The next assignment id in the property: 'AS' and a number of at least three digits, AS001 first. */
async function nextId(propertyId) {
  const count = await Assignment.countDocuments({ propertyId });
  return `AS${String(count + 1).padStart(3, '0')}`;
}

async function insert(assignment) {
  await Assignment.create(assignment);
}

function byId(propertyId, assignmentId) {
  return Assignment.findOne({ propertyId, assignmentId }).lean();
}

/** The open assignment (closedAt null) of each of these stays, keyed by stayId. */
async function openForStays(propertyId, stayIds) {
  const open = await Assignment.find({ propertyId, stayId: { $in: stayIds }, closedAt: null }).lean();
  return new Map(open.map((a) => [a.stayId, a]));
}

/** Stamps the assignment; inside a transaction when given its session. */
async function stamp(assignmentId, fields, session) {
  await Assignment.updateOne({ assignmentId }, { $set: fields }, { session });
}

module.exports = { nextId, insert, byId, openForStays, stamp };
