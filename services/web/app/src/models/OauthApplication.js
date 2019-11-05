const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')

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

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const OauthApplication = conn.model('OauthApplication', OauthApplicationSchema)

mongoose.model('OauthApplication', OauthApplicationSchema)
exports.OauthApplication = OauthApplication
exports.OauthApplicationSchema = OauthApplicationSchema
