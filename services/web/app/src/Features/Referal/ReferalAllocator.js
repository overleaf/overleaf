/* eslint-disable
    camelcase,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ReferalAllocator
const _ = require('underscore')
const logger = require('logger-sharelatex')
const { User } = require('../../models/User')
const Settings = require('settings-sharelatex')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')

module.exports = ReferalAllocator = {
  allocate(referal_id, new_user_id, referal_source, referal_medium, callback) {
    if (callback == null) {
      callback = function() {}
    }
    if (referal_id == null) {
      logger.log({ new_user_id }, 'no referal for user')
      return callback(null)
    }

    logger.log(
      { referal_id, new_user_id, referal_source, referal_medium },
      'allocating users referal'
    )

    const query = { referal_id: referal_id }
    return User.findOne(query, function(error, user) {
      if (error != null) {
        return callback(error)
      }
      if (user == null || user._id == null) {
        logger.log({ new_user_id, referal_id }, 'no user found for referal id')
        return callback(null)
      }

      if (referal_source === 'bonus') {
        return User.update(
          query,
          {
            $push: {
              refered_users: new_user_id
            },
            $inc: {
              refered_user_count: 1
            }
          },
          {},
          function(err) {
            if (err != null) {
              logger.warn(
                { err, referal_id, new_user_id },
                'something went wrong allocating referal'
              )
              return callback(err)
            }

            return FeaturesUpdater.refreshFeatures(user._id, callback)
          }
        )
      } else {
        return callback()
      }
    })
  }
}
