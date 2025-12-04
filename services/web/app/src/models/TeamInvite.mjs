import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const TeamInviteSchema = new Schema(
  {
    email: { type: String, required: true },
    token: { type: String },
    inviterName: { type: String, optional: true },
    sentAt: { type: Date },
    domainCapture: { type: Boolean, default: false, optional: true },
  },
  { minimize: false }
)

export const TeamInvite = mongoose.model('TeamInvite', TeamInviteSchema)
