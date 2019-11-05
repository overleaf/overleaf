const mongoose = require('mongoose')

const { Schema } = mongoose

const TeamInviteSchema = new Schema({
  email: { type: String, required: true },
  token: { type: String },
  inviterName: { type: String },
  sentAt: { type: Date }
})

mongoose.model('TeamInvite', TeamInviteSchema)
exports.TeamInvite = mongoose.model('TeamInvite')
exports.TeamInviteSchema = TeamInviteSchema
