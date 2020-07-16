const _ = require('underscore')
const { User } = require('../../models/User')
const Settings = require('settings-sharelatex')

let ReferalFeatures

module.exports = ReferalFeatures = {
  getBonusFeatures(userId, callback) {
    if (callback == null) {
      callback = function() {}
    }
    const query = { _id: userId }
    User.findOne(query, { refered_user_count: 1 }, function(error, user) {
      if (error) {
        return callback(error)
      }
      if (user == null) {
        return callback(new Error(`user not found ${userId} for assignBonus`))
      }
      if (user.refered_user_count != null && user.refered_user_count > 0) {
        const newFeatures = ReferalFeatures._calculateFeatures(user)
        callback(null, newFeatures)
      } else {
        callback(null, {})
      }
    })
  },

  _calculateFeatures(user) {
    const bonusLevel = ReferalFeatures._getBonusLevel(user)
    return (
      (Settings.bonus_features != null
        ? Settings.bonus_features[`${bonusLevel}`]
        : undefined) || {}
    )
  },

  _getBonusLevel(user) {
    let highestBonusLevel = 0
    _.each(_.keys(Settings.bonus_features), function(level) {
      const levelIsLessThanUser = level <= user.refered_user_count
      const levelIsMoreThanCurrentHighest = level >= highestBonusLevel
      if (levelIsLessThanUser && levelIsMoreThanCurrentHighest) {
        return (highestBonusLevel = level)
      }
    })
    return highestBonusLevel
  }
}
