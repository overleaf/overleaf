const { User } = require('../../models/User')

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
    for (const key in features) {
      const value = features[key]
      update[`features.${key}`] = value
    }
    User.findByIdAndUpdate(userId, update, (err, docBeforeUpdate) => {
      let featuresChanged = false
      if (docBeforeUpdate) {
        featuresChanged = _featuresChanged(features, docBeforeUpdate.features)
      }

      return callback(err, features, featuresChanged)
    })
  },

  overrideFeatures(userId, features, callback) {
    const update = { features, featuresUpdatedAt: new Date() }
    User.findByIdAndUpdate(userId, update, (err, docBeforeUpdate) => {
      let featuresChanged = false
      if (docBeforeUpdate) {
        featuresChanged = _featuresChanged(features, docBeforeUpdate.features)
      }
      return callback(err, featuresChanged)
    })
  },
}
