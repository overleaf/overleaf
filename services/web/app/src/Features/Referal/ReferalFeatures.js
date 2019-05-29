/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ReferalFeatures
const _ = require('underscore')
const logger = require('logger-sharelatex')
const { User } = require('../../models/User')
const Settings = require('settings-sharelatex')

module.exports = ReferalFeatures = {
  getBonusFeatures(user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const query = { _id: user_id }
    return User.findOne(query, function(error, user) {
      if (error) {
        return callback(error)
      }
      if (user == null) {
        return callback(new Error(`user not found ${user_id} for assignBonus`))
      }
      logger.log(
        { user_id, refered_user_count: user.refered_user_count },
        'assigning bonus'
      )
      if (user.refered_user_count != null && user.refered_user_count > 0) {
        const newFeatures = ReferalFeatures._calculateFeatures(user)
        return callback(null, newFeatures)
      } else {
        return callback(null, {})
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
