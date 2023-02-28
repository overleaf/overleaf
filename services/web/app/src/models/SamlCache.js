const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const SamlCacheSchema = new Schema(
  {
    createdAt: { type: Date },
    requestId: { type: String },
  },
  {
    collection: 'samlCache',
    minimize: false,
  }
)

exports.SamlCache = mongoose.model('SamlCache', SamlCacheSchema)
exports.SamlCacheSchema = SamlCacheSchema
