const Settings = require('settings-sharelatex')
const mongoose = require('mongoose')
const { Schema } = mongoose

const SamlLogSchema = new Schema(
  {
    createdAt: { type: Date, default: () => new Date() },
    data: { type: Object, default: {} },
    providerId: { type: String, default: '' },
    sessionId: { type: String, default: '' }
  },
  {
    collection: 'samlLogs'
  }
)

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const SamlLog = conn.model('SamlLog', SamlLogSchema)

mongoose.model('SamlLog', SamlLogSchema)
exports.SamlLog = SamlLog
exports.SamlLogSchema = SamlLogSchema
