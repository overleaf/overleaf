const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const ProjectAuditLogEntrySchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, index: true },
    operation: { type: String },
    initiatorId: { type: Schema.Types.ObjectId },
    timestamp: { type: Date, default: Date.now },
    info: { type: Object },
  },
  {
    collection: 'projectAuditLogEntries',
    minimize: false,
  }
)

exports.ProjectAuditLogEntry = mongoose.model(
  'ProjectAuditLogEntry',
  ProjectAuditLogEntrySchema
)
exports.ProjectAuditLogEntrySchema = ProjectAuditLogEntrySchema
