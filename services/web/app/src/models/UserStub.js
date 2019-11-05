const Settings = require('settings-sharelatex')
const mongoose = require('mongoose')
const { Schema } = mongoose

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

mongoose.model('UserStub', UserStubSchema)
exports.UserStub = UserStub
exports.UserStubSchema = UserStubSchema
