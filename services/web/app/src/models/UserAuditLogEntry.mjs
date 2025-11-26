import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const UserAuditLogEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, index: true },
    managedSubscriptionId: { type: Schema.Types.ObjectId, index: true },
    info: { type: Object },
    initiatorId: { type: Schema.Types.ObjectId },
    ipAddress: { type: String },
    operation: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  {
    collection: 'userAuditLogEntries',
    minimize: false,
  }
)

export const UserAuditLogEntry = mongoose.model(
  'UserAuditLogEntry',
  UserAuditLogEntrySchema
)
