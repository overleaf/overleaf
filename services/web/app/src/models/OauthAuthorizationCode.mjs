import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

export const OauthAuthorizationCodeSchema = new Schema(
  {
    authorizationCode: String,
    expiresAt: Date,
    oauthApplication_id: { type: ObjectId, ref: 'OauthApplication' },
    redirectUri: String,
    scope: String,
    user_id: { type: ObjectId, ref: 'User' },
    codeChallenge: String,
    codeChallengeMethod: String,
  },
  {
    collection: 'oauthAuthorizationCodes',
    minimize: false,
  }
)

export const OauthAuthorizationCode = mongoose.model(
  'OauthAuthorizationCode',
  OauthAuthorizationCodeSchema
)
