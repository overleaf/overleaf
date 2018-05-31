mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

TeamInviteSchema = new Schema
	email          :     { type: String, required: true }
	token          :     { type: String }
	inviterName    :     { type: String }
	sentAt         :     { type: Date }

mongoose.model 'TeamInvite', TeamInviteSchema
exports.TeamInvite = mongoose.model 'TeamInvite'
exports.TeamInviteSchema = TeamInviteSchema
