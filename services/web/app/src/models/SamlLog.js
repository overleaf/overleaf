const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const SamlLogSchema = new Schema(
  {
    createdAt: { type: Date, default: () => new Date() },
    data: { type: Object },
    jsonData: { type: String },
    path: { type: String },
    providerId: { type: String, default: '' },
    samlAssertion: { type: String },
    sessionId: { type: String, default: '' },
    userId: { type: String, default: '' },
  },
  {
    collection: 'samlLogs',
    minimize: false,
  }
)

exports.SamlLog = mongoose.model('SamlLog', SamlLogSchema)
exports.SamlLogSchema = SamlLogSchema
