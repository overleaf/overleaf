const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const Usage = new Schema({
  usage: { type: Number },
  periodStart: { type: Date },
})

const UserFeatureUsageSchema = new Schema({
  features: {
    aiErrorAssistant: Usage,
  },
})

exports.UserFeatureUsage = mongoose.model(
  'UserFeatureUsage',
  UserFeatureUsageSchema
)

exports.UserFeatureUsageSchema = UserFeatureUsageSchema
