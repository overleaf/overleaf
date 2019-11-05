const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose

const SystemMessageSchema = new Schema({
  content: { type: String, default: '' }
})

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

exports.SystemMessage = conn.model('SystemMessage', SystemMessageSchema)
