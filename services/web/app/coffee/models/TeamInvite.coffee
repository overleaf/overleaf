mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

TeamInviteSchema = new Schema
	subscriptionId :     { type: ObjectId, ref: 'Subscription', required: true  }
	email          :     { type: String, required: true }
	token          :     { type: String, required: true }
	sentAt         :     { type: Date, required: true }


mongoose.model 'TeamInvite', TeamInviteSchema
exports.TeamInvite = mongoose.model 'TeamInvite'
exports.TeamInviteSchema = TeamInviteSchema
