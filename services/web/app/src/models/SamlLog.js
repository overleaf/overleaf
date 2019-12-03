const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const SamlLogSchema = new Schema(
  {
    createdAt: { type: Date, default: () => new Date() },
    data: { type: Object },
    jsonData: { type: String },
    providerId: { type: String, default: '' },
    sessionId: { type: String, default: '' }
  },
  {
    collection: 'samlLogs'
  }
)

exports.SamlLog = mongoose.model('SamlLog', SamlLogSchema)
exports.SamlLogSchema = SamlLogSchema
