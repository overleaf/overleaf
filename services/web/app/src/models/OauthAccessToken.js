const mongoose = require('../infrastructure/Mongoose')

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

exports.OauthAccessToken = mongoose.model(
  'OauthAccessToken',
  OauthAccessTokenSchema
)

exports.OauthAccessTokenSchema = OauthAccessTokenSchema
