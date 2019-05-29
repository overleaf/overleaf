/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose
const { ObjectId } = Schema

const SystemMessageSchema = new Schema({
  content: { type: String, default: '' }
})

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

exports.SystemMessage = conn.model('SystemMessage', SystemMessageSchema)
