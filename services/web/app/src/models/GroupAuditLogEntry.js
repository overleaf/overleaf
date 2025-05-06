const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const GroupAuditLogEntrySchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, index: true },
    info: { type: Object },
    initiatorId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String },
    operation: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  {
    collection: 'groupAuditLogEntries',
    minimize: false,
  }
)

exports.GroupAuditLogEntry = mongoose.model(
  'GroupAuditLogEntry',
  GroupAuditLogEntrySchema
)
exports.GroupAuditLogEntrySchema = GroupAuditLogEntrySchema
