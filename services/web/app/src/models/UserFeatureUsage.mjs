import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

const Usage = new Schema({
  usage: { type: Number },
  periodStart: { type: Date },
})

export const UserFeatureUsageSchema = new Schema({
  features: {
    aiFeatureUsage: Usage,
    aiWorkbench: Usage,
  },
})

export const UserFeatureUsage = mongoose.model(
  'UserFeatureUsage',
  UserFeatureUsageSchema
)
