const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const GlobalMetricSchema = new Schema(
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

exports.GlobalMetric = mongoose.model('GlobalMetric', GlobalMetricSchema)
exports.GlobalMetricSchema = GlobalMetricSchema
