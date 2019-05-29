/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const Settings = require('settings-sharelatex')
const mongoose = require('mongoose')
const { Schema } = mongoose
const { ObjectId } = Schema

const UserStubSchema = new Schema({
  email: { type: String, default: '' },
  first_name: { type: String, default: '' },
  last_name: { type: String, default: '' },
  overleaf: { id: { type: Number } },
  thirdPartyIdentifiers: { type: Array, default: [] },
  confirmed_at: Date
})

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const UserStub = conn.model('UserStub', UserStubSchema)

const model = mongoose.model('UserStub', UserStubSchema)
exports.UserStub = UserStub
