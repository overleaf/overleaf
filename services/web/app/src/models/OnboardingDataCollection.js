const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const OnboardingDataCollectionSchema = new Schema(
  {
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    primaryOccupation: { type: String, default: null },
    usedLatex: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: 'onboardingDataCollection',
    minimize: false,
  }
)

module.exports = {
  OnboardingDataCollection: mongoose.model(
    'OnboardingDataCollection',
    OnboardingDataCollectionSchema
  ),
  OnboardingDataCollectionSchema,
}
