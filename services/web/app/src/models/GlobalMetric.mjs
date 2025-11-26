import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const GlobalMetricSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: {
      type: Number,
      default: 0,
    },
  },
  {
    collection: 'globalMetrics',
    minimize: false,
  }
)

export const GlobalMetric = mongoose.model('GlobalMetric', GlobalMetricSchema)
