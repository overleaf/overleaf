mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

OauthApplicationSchema = new Schema(
	{
		id: String
		clientSecret: String
		grants: [ String ]
		name: String
		redirectUris: [ String ]
		scopes: [ String ]
	},
	{
		collection: 'oauthApplications'
	}
)

conn = mongoose.createConnection(Settings.mongo.url, {
	server: {poolSize: Settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

OauthApplication = conn.model('OauthApplication', OauthApplicationSchema)

mongoose.model 'OauthApplication', OauthApplicationSchema
exports.OauthApplication = OauthApplication
exports.OauthApplicationSchema = OauthApplicationSchema
