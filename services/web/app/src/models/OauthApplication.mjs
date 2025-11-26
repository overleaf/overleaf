import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const OauthApplicationSchema = new Schema(
  {
    id: String,
    clientSecret: String,
    grants: [String],
    name: String,
    redirectUris: [String],
    scopes: [String],
    pkceEnabled: Boolean,
  },
  {
    collection: 'oauthApplications',
    minimize: false,
  }
)

export const OauthApplication = mongoose.model(
  'OauthApplication',
  OauthApplicationSchema
)
