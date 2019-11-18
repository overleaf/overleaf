const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose

const OauthApplicationSchema = new Schema(
  {
    id: String,
    clientSecret: String,
    grants: [String],
    name: String,
    redirectUris: [String],
    scopes: [String]
  },
  {
    collection: 'oauthApplications'
  }
)

exports.OauthApplication = mongoose.model(
  'OauthApplication',
  OauthApplicationSchema
)

exports.OauthApplicationSchema = OauthApplicationSchema
