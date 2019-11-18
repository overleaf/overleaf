const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const UserStubSchema = new Schema({
  email: { type: String, default: '' },
  first_name: { type: String, default: '' },
  last_name: { type: String, default: '' },
  overleaf: { id: { type: Number } },
  thirdPartyIdentifiers: { type: Array, default: [] },
  confirmed_at: Date
})

exports.UserStub = mongoose.model('UserStub', UserStubSchema)
exports.UserStubSchema = UserStubSchema
