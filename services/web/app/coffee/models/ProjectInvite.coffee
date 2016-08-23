mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'


Schema = mongoose.Schema
ObjectId = Schema.ObjectId


EXPIRY_IN_SECONDS = 60 * 60 * 24 * 30

ExpiryDate = () ->
	timestamp = new Date()
	timestamp.setSeconds(timestamp.getSeconds() + EXPIRY_IN_SECONDS)
	return timestamp



ProjectInviteSchema = new Schema(
	{
		email:          String
		token:          String
		sendingUserId:  ObjectId
		projectId:      ObjectId
		privileges:     String
		createdAt:      {type: Date, default: Date.now}
		expires:        {type: Date, default: ExpiryDate, index: {expireAfterSeconds: 10}}
	},
	{
		collection: 'projectInvites'
	}
)


conn = mongoose.createConnection(Settings.mongo.url, server: poolSize: Settings.mongo.poolSize || 10)


ProjectInvite = conn.model('ProjectInvite', ProjectInviteSchema)

mongoose.model 'ProjectInvite', ProjectInviteSchema
exports.ProjectInvite = ProjectInvite
exports.ProjectInviteSchema = ProjectInviteSchema
exports.EXPIRY_IN_SECONDS = EXPIRY_IN_SECONDS
