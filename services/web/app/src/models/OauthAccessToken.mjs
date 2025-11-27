import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

export const OauthAccessTokenSchema = new Schema(
  {
    accessToken: String,
    accessTokenPartial: String,
    type: String,
    accessTokenExpiresAt: Date,
    oauthApplication_id: { type: ObjectId, ref: 'OauthApplication' },
    refreshToken: String,
    refreshTokenExpiresAt: Date,
    scope: String,
    user_id: { type: ObjectId, ref: 'User' },
    createdAt: { type: Date },
    expiresAt: Date,
    lastUsedAt: Date,
  },
  {
    collection: 'oauthAccessTokens',
    minimize: false,
  }
)

export const OauthAccessToken = mongoose.model(
  'OauthAccessToken',
  OauthAccessTokenSchema
)
