const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const UserAuditLogEntrySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, index: true },
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

exports.UserAuditLogEntry = mongoose.model(
  'UserAuditLogEntry',
  UserAuditLogEntrySchema
)
exports.UserAuditLogEntrySchema = UserAuditLogEntrySchema
