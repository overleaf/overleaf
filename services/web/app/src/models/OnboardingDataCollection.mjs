import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const OnboardingDataCollectionSchema = new Schema(
  {
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    primaryOccupation: { type: String, default: null },
    usedLatex: { type: String, default: null },
    companyDivisionDepartment: { type: String, default: null },
    companyJobTitle: { type: String, default: null },
    governmentJobTitle: { type: String, default: null },
    institutionName: { type: String, default: null },
    otherJobTitle: { type: String, default: null },
    nonprofitDivisionDepartment: { type: String, default: null },
    nonprofitJobTitle: { type: String, default: null },
    role: { type: String, default: null },
    subjectArea: { type: String, default: null },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    collection: 'onboardingDataCollection',
    minimize: false,
  }
)

export const OnboardingDataCollection = mongoose.model(
  'OnboardingDataCollection',
  OnboardingDataCollectionSchema
)

export default {
  OnboardingDataCollection,
  OnboardingDataCollectionSchema,
}
