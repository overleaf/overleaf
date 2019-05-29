/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose
const { ObjectId } = Schema

const EXPIRY_IN_SECONDS = 60 * 60 * 24 * 30

const ExpiryDate = function() {
  const timestamp = new Date()
  timestamp.setSeconds(timestamp.getSeconds() + EXPIRY_IN_SECONDS)
  return timestamp
}

const ProjectInviteSchema = new Schema(
  {
    email: String,
    token: String,
    sendingUserId: ObjectId,
    projectId: ObjectId,
    privileges: String,
    createdAt: { type: Date, default: Date.now },
    expires: {
      type: Date,
      default: ExpiryDate,
      index: { expireAfterSeconds: 10 }
    }
  },
  {
    collection: 'projectInvites'
  }
)

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const ProjectInvite = conn.model('ProjectInvite', ProjectInviteSchema)

mongoose.model('ProjectInvite', ProjectInviteSchema)
exports.ProjectInvite = ProjectInvite
exports.ProjectInviteSchema = ProjectInviteSchema
exports.EXPIRY_IN_SECONDS = EXPIRY_IN_SECONDS
