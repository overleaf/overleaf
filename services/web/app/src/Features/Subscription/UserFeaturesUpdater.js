const { User } = require('../../models/User')
const { callbackify } = require('util')
const Settings = require('@overleaf/settings')

function _featuresChanged(newFeatures, featuresBefore) {
  for (const feature in newFeatures) {
    if (featuresBefore[feature] !== newFeatures[feature]) {
      return true
    }
  }
  return false
}

async function updateFeatures(userId, features) {
  const update = {
    featuresUpdatedAt: new Date(),
  }
  // record the system-wide features epoch, if defined
  if (Settings.featuresEpoch) {
    update.featuresEpoch = Settings.featuresEpoch
  }
  for (const key in features) {
    const value = features[key]
    update[`features.${key}`] = value
  }
  const docBeforeUpdate = await User.findByIdAndUpdate(userId, update).exec()
  let featuresChanged = false
  if (docBeforeUpdate) {
    featuresChanged = _featuresChanged(features, docBeforeUpdate.features)
  }

  return { features, featuresChanged }
}

async function overrideFeatures(userId, features) {
  const update = { features, featuresUpdatedAt: new Date() }
  const docBeforeUpdate = await User.findByIdAndUpdate(userId, update).exec()
  let featuresChanged = false
  if (docBeforeUpdate) {
    featuresChanged = _featuresChanged(features, docBeforeUpdate.features)
  }
  return featuresChanged
}

async function createFeaturesOverride(userId, featuresOverride) {
  return await User.updateOne(
    { _id: userId },
    { $push: { featuresOverrides: featuresOverride } }
  ).exec()
}

module.exports = {
  updateFeatures: callbackify(updateFeatures),
  overrideFeatures: callbackify(overrideFeatures),
  createFeaturesOverride: callbackify(createFeaturesOverride),
  promises: {
    updateFeatures,
    overrideFeatures,
    createFeaturesOverride,
  },
}
