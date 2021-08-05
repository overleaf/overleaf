const { User } = require('../../models/User')

module.exports = {
  updateFeatures(userId, features, callback) {
    const conditions = { _id: userId }
    const update = {
      featuresUpdatedAt: new Date(),
    }
    for (const key in features) {
      const value = features[key]
      update[`features.${key}`] = value
    }
    User.updateOne(conditions, update, (err, result) =>
      callback(err, features, (result ? result.nModified : 0) === 1)
    )
  },

  overrideFeatures(userId, features, callback) {
    const conditions = { _id: userId }
    const update = { features, featuresUpdatedAt: new Date() }
    User.updateOne(conditions, update, (err, result) =>
      callback(err, (result ? result.nModified : 0) === 1)
    )
  },
}
