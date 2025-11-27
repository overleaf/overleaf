import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

export const EXPIRY_IN_SECONDS = 60 * 60 * 24 * 30

const ExpiryDate = function () {
  const timestamp = new Date()
  timestamp.setSeconds(timestamp.getSeconds() + EXPIRY_IN_SECONDS)
  return timestamp
}

export const ProjectInviteSchema = new Schema(
  {
    email: String,
    tokenHmac: String,
    sendingUserId: ObjectId,
    projectId: ObjectId,
    privileges: String,
    createdAt: { type: Date, default: Date.now },
    expires: {
      type: Date,
      default: ExpiryDate,
      index: { expireAfterSeconds: 10 },
    },
  },
  {
    collection: 'projectInvites',
    minimize: false,
  }
)

export const ProjectInvite = mongoose.model(
  'ProjectInvite',
  ProjectInviteSchema
)
