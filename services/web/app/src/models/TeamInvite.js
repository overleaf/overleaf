/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose
const { ObjectId } = Schema

const TeamInviteSchema = new Schema({
  email: { type: String, required: true },
  token: { type: String },
  inviterName: { type: String },
  sentAt: { type: Date }
})

mongoose.model('TeamInvite', TeamInviteSchema)
exports.TeamInvite = mongoose.model('TeamInvite')
exports.TeamInviteSchema = TeamInviteSchema
