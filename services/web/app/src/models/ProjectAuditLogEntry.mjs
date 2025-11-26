import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const ProjectAuditLogEntrySchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, index: true },
    managedSubscriptionId: { type: Schema.Types.ObjectId, index: true },
    operation: { type: String },
    initiatorId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String },
    timestamp: { type: Date, default: Date.now },
    info: { type: Object },
  },
  {
    collection: 'projectAuditLogEntries',
    minimize: false,
  }
)

export const ProjectAuditLogEntry = mongoose.model(
  'ProjectAuditLogEntry',
  ProjectAuditLogEntrySchema
)
