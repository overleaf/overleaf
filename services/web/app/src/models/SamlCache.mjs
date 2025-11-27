import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const SamlCacheSchema = new Schema(
  {
    createdAt: { type: Date },
    requestId: { type: String },
  },
  {
    collection: 'samlCache',
    minimize: false,
  }
)

export const SamlCache = mongoose.model('SamlCache', SamlCacheSchema)
