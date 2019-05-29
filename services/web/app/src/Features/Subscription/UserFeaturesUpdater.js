/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const logger = require('logger-sharelatex')
const { User } = require('../../models/User')

module.exports = {
  updateFeatures(user_id, features, callback) {
    if (callback == null) {
      callback = function(err, features, featuresChanged) {}
    }
    const conditions = { _id: user_id }
    const update = {}
    logger.log({ user_id, features }, 'updating users features')
    for (let key in features) {
      const value = features[key]
      update[`features.${key}`] = value
    }
    return User.update(conditions, update, (err, result) =>
      callback(
        err,
        features,
        (result != null ? result.nModified : undefined) === 1
      )
    )
  }
}
