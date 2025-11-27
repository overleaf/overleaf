import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const GroupAuditLogEntrySchema = new Schema(
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

export const GroupAuditLogEntry = mongoose.model(
  'GroupAuditLogEntry',
  GroupAuditLogEntrySchema
)
