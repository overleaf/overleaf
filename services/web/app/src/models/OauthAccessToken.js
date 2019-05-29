// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose
const { ObjectId } = Schema

const OauthAccessTokenSchema = new Schema(
  {
    accessToken: String,
    accessTokenExpiresAt: Date,
    oauthApplication_id: { type: ObjectId, ref: 'OauthApplication' },
    refreshToken: String,
    refreshTokenExpiresAt: Date,
    scope: String,
    user_id: { type: ObjectId, ref: 'User' }
  },
  {
    collection: 'oauthAccessTokens'
  }
)

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const OauthAccessToken = conn.model('OauthAccessToken', OauthAccessTokenSchema)

mongoose.model('OauthAccessToken', OauthAccessTokenSchema)
exports.OauthAccessToken = OauthAccessToken
exports.OauthAccessTokenSchema = OauthAccessTokenSchema
