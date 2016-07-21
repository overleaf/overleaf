mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

THIRTY_DAYS_IN_SECONDS = 60 * 60 * 24 * 30

makeExpirationDate = () ->
	nowInMillis = Date.now()
	new Date(nowInMillis + (1000 * THIRTY_DAYS_IN_SECONDS))


ProjectInviteSchema = new Schema
	email:          String
	token:          String
	sendingUserId:  ObjectId
	projectId:      ObjectId
	privileges:     String
	createdAt:      {type: Date, default: Date.now}
	expiresAt:      {type: Date, default: makeExpirationDate}

conn = mongoose.createConnection(Settings.mongo.url, server: poolSize: Settings.mongo.poolSize || 10)

ProjectInvite = conn.model('ProjectInvite', ProjectInviteSchema)

mongoose.model 'ProjectInvite', ProjectInviteSchema
exports.ProjectInvite = ProjectInvite
exports.ProjectInviteSchema = ProjectInviteSchema
