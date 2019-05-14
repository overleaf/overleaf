mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

OauthAccessTokenSchema = new Schema(
	{
		accessToken: String
		accessTokenExpiresAt: Date
		oauthApplication_id: { type: ObjectId, ref: 'OauthApplication' }
		refreshToken: String
		refreshTokenExpiresAt: Date
		scope: String
		user_id: { type: ObjectId, ref: 'User' }
	},
	{
		collection: 'oauthAccessTokens'
	}
)

conn = mongoose.createConnection(Settings.mongo.url, {
	server: {poolSize: Settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

OauthAccessToken = conn.model('OauthAccessToken', OauthAccessTokenSchema)

mongoose.model 'OauthAccessToken', OauthAccessTokenSchema
exports.OauthAccessToken = OauthAccessToken
exports.OauthAccessTokenSchema = OauthAccessTokenSchema
