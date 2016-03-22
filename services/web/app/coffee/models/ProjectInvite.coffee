mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

ProjectInviteSchema = new Schema
	project_id:     ObjectId
	from_user_id:   ObjectId
	privilegeLevel: String
	# For existing users
	to_user_id:     ObjectId
	# For non-existant users
	hashed_token:   String
	email:          String

conn = mongoose.createConnection(Settings.mongo.url, server: poolSize: Settings.mongo.poolSize || 10)

ProjectInvite = conn.model('ProjectInvite', ProjectInviteSchema)

mongoose.model 'ProjectInvite', ProjectInviteSchema
exports.ProjectInvite = ProjectInvite
exports.ProjectInviteSchema = ProjectInviteSchema