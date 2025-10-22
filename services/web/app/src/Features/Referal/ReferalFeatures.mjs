const _ = require('lodash')
const { callbackify } = require('util')
const { User } = require('../../models/User')
const Settings = require('@overleaf/settings')

const ReferalFeatures = {
  async getBonusFeatures(userId) {
    const query = { _id: userId }
    const user = await User.findOne(query, { refered_user_count: 1 }).exec()

    if (user == null) {
      throw new Error(`user not found ${userId} for assignBonus`)
    }

    if (user.refered_user_count != null && user.refered_user_count > 0) {
      const newFeatures = ReferalFeatures._calculateFeatures(user)
      return newFeatures
    }

    return {}
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
    _.forEach(_.keys(Settings.bonus_features), function (level) {
      const levelIsLessThanUser = level <= user.refered_user_count
      const levelIsMoreThanCurrentHighest = level >= highestBonusLevel
      if (levelIsLessThanUser && levelIsMoreThanCurrentHighest) {
        return (highestBonusLevel = level)
      }
    })
    return highestBonusLevel
  },
}

module.exports = {
  getBonusFeatures: callbackify(ReferalFeatures.getBonusFeatures),
  promises: ReferalFeatures,
}
