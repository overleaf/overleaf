/* eslint-disable
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

const { Schema } = mongoose
const { ObjectId } = Schema

const OauthAuthorizationCodeSchema = new Schema(
  {
    authorizationCode: String,
    expiresAt: Date,
    oauthApplication_id: { type: ObjectId, ref: 'OauthApplication' },
    redirectUri: String,
    scope: String,
    user_id: { type: ObjectId, ref: 'User' }
  },
  {
    collection: 'oauthAuthorizationCodes'
  }
)

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const OauthAuthorizationCode = conn.model(
  'OauthAuthorizationCode',
  OauthAuthorizationCodeSchema
)

mongoose.model('OauthAuthorizationCode', OauthAuthorizationCodeSchema)
exports.OauthAuthorizationCode = OauthAuthorizationCode
exports.OauthAuthorizationCodeSchema = OauthAuthorizationCodeSchema
