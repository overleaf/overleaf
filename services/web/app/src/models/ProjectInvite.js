const mongoose = require('../infrastructure/Mongoose')

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

exports.ProjectInvite = mongoose.model('ProjectInvite', ProjectInviteSchema)
exports.ProjectInviteSchema = ProjectInviteSchema
exports.EXPIRY_IN_SECONDS = EXPIRY_IN_SECONDS
