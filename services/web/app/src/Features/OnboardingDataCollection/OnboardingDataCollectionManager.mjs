import OnboardingDataCollectionModel from '../../models/OnboardingDataCollection.mjs'
import OError from '@overleaf/o-error'

const { OnboardingDataCollection, OnboardingDataCollectionSchema } =
  OnboardingDataCollectionModel

async function getOnboardingDataCollection(userId, projection = {}) {
  try {
    return await OnboardingDataCollection.findOne(
      { _id: userId },
      projection
    ).exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get OnboardingDataCollection')
  }
}

async function getOnboardingDataValue(userId, key) {
  if (!OnboardingDataCollectionSchema.paths[key]) {
    throw new Error(`${key} is not a valid onboarding data key`)
  }

  const result = await getOnboardingDataCollection(userId, { [key]: 1 })
  return result ? result[key] : null
}

async function upsertOnboardingDataCollection({
  userId,
  firstName,
  lastName,
  usedLatex,
  primaryOccupation,
  companyDivisionDepartment,
  companyJobTitle,
  governmentJobTitle,
  institutionName,
  otherJobTitle,
  nonprofitDivisionDepartment,
  nonprofitJobTitle,
  role,
  subjectArea,
  updatedAt,
}) {
  const odc = await OnboardingDataCollection.findOneAndUpdate(
    { _id: userId },
    {
      firstName,
      lastName,
      usedLatex,
      primaryOccupation,
      companyDivisionDepartment,
      companyJobTitle,
      governmentJobTitle,
      institutionName,
      otherJobTitle,
      nonprofitDivisionDepartment,
      nonprofitJobTitle,
      role,
      subjectArea,
      updatedAt,
    },
    { upsert: true }
  )

  return odc
}

function deleteOnboardingDataCollection(id) {
  return OnboardingDataCollection.deleteOne({ _id: id })
}

export default {
  getOnboardingDataCollection,
  upsertOnboardingDataCollection,
  deleteOnboardingDataCollection,
  getOnboardingDataValue,
}
