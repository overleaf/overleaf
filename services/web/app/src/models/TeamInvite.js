const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose

const TeamInviteSchema = new Schema({
  email: { type: String, required: true },
  token: { type: String },
  inviterName: { type: String },
  sentAt: { type: Date }
})

exports.TeamInvite = mongoose.model('TeamInvite', TeamInviteSchema)
exports.TeamInviteSchema = TeamInviteSchema
