import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const SSOConfigSchema = new Schema(
  {
    entryPoint: { type: String, required: true },
    certificates: { type: Array, default: [''], required: true },
    userIdAttribute: { type: String, required: true },
    userEmailAttribute: { type: String },
    userFirstNameAttribute: { type: String },
    userLastNameAttribute: { type: String },
    validated: { type: Boolean, default: false },
    enabled: { type: Boolean, default: false },
    useSettingsUKAMF: { type: Boolean, default: false },
  },

  {
    collection: 'ssoConfigs',
    minimize: false,
  }
)

export const SSOConfig = mongoose.model('SSOConfig', SSOConfigSchema)
