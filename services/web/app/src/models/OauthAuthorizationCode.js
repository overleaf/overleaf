const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose
const { ObjectId } = Schema

const OauthAuthorizationCodeSchema = new Schema(
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

exports.OauthAuthorizationCode = mongoose.model(
  'OauthAuthorizationCode',
  OauthAuthorizationCodeSchema
)

exports.OauthAuthorizationCodeSchema = OauthAuthorizationCodeSchema
