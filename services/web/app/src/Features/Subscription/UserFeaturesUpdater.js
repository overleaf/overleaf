const { User } = require('../../models/User')
const { promisifyAll } = require('../../util/promises')
const Settings = require('@overleaf/settings')

function _featuresChanged(newFeatures, featuresBefore) {
  for (const feature in newFeatures) {
    if (featuresBefore[feature] !== newFeatures[feature]) {
      return true
    }
  }
  return false
}

module.exports = {
  updateFeatures(userId, features, callback) {
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
    User.findByIdAndUpdate(userId, update, (err, docBeforeUpdate) => {
      let featuresChanged = false
      if (docBeforeUpdate) {
        featuresChanged = _featuresChanged(features, docBeforeUpdate.features)
      }

      callback(err, features, featuresChanged)
    })
  },

  overrideFeatures(userId, features, callback) {
    const update = { features, featuresUpdatedAt: new Date() }
    User.findByIdAndUpdate(userId, update, (err, docBeforeUpdate) => {
      let featuresChanged = false
      if (docBeforeUpdate) {
        featuresChanged = _featuresChanged(features, docBeforeUpdate.features)
      }
      callback(err, featuresChanged)
    })
  },

  createFeaturesOverride(userId, featuresOverride, callback) {
    User.updateOne(
      { _id: userId },
      { $push: { featuresOverrides: featuresOverride } },
      callback
    )
  },
}

module.exports.promises = promisifyAll(module.exports, {
  multiResult: {
    updateFeatures: ['features', 'featuresChanged'],
  },
})
