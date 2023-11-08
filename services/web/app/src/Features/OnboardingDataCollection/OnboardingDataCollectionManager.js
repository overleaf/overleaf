const {
  OnboardingDataCollection,
} = require('../../models/OnboardingDataCollection')
const OError = require('@overleaf/o-error')

async function getOnboardingDataCollection(userId) {
  try {
    return await OnboardingDataCollection.findOne({ _id: userId }).exec()
  } catch (error) {
    throw OError.tag(error, 'Failed to get OnboardingDataCollection')
  }
}

async function upsertOnboardingDataCollection({
  userId,
  firstName,
  lastName,
  usedLatex,
  primaryOccupation,
  updatedAt,
}) {
  const odc = await OnboardingDataCollection.findOneAndUpdate(
    { _id: userId },
    {
      firstName,
      lastName,
      usedLatex,
      primaryOccupation,
      updatedAt,
    },
    { upsert: true }
  )

  return odc
}

function deleteOnboardingDataCollection(id) {
  return OnboardingDataCollection.deleteOne({ _id: id })
}

module.exports = {
  getOnboardingDataCollection,
  upsertOnboardingDataCollection,
  deleteOnboardingDataCollection,
}
