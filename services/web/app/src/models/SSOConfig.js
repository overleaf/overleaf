const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const SSOConfigSchema = new Schema(
  {
    entryPoint: { type: String, required: true },
    certificates: { type: Array, default: [''], required: true },
    userIdAttribute: { type: String, required: true },
    userFirstNameAttribute: { type: String },
    userLastNameAttribute: { type: String },
    validated: { type: Boolean, default: false },
    enabled: { type: Boolean, default: false },
  },

  {
    collection: 'ssoConfigs',
    minimize: false,
  }
)

exports.SSOConfig = mongoose.model('SSOConfig', SSOConfigSchema)
exports.SSOConfigSchema = SSOConfigSchema
