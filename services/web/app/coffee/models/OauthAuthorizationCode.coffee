mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

OauthAuthorizationCodeSchema = new Schema(
	{
		authorizationCode: String
		expiresAt: Date
		oauthApplication_id: { type: ObjectId, ref: 'OauthApplication' }
		redirectUri: String
		scope: String
		user_id: { type: ObjectId, ref: 'User' }
	},
	{
		collection: 'oauthAuthorizationCodes'
	}
)

conn = mongoose.createConnection(Settings.mongo.url, {
	server: {poolSize: Settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

OauthAuthorizationCode = conn.model('OauthAuthorizationCode', OauthAuthorizationCodeSchema)

mongoose.model 'OauthAuthorizationCode', OauthAuthorizationCodeSchema
exports.OauthAuthorizationCode = OauthAuthorizationCode
exports.OauthAuthorizationCodeSchema = OauthAuthorizationCodeSchema
