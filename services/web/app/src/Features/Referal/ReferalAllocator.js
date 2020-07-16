const logger = require('logger-sharelatex')
const { User } = require('../../models/User')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')

module.exports = {
  allocate(referalId, newUserId, referalSource, referalMedium, callback) {
    if (callback == null) {
      callback = function() {}
    }
    if (referalId == null) {
      return callback(null)
    }

    const query = { referal_id: referalId }
    return User.findOne(query, { _id: 1 }, function(error, user) {
      if (error != null) {
        return callback(error)
      }
      if (user == null || user._id == null) {
        return callback(null)
      }

      if (referalSource === 'bonus') {
        User.update(
          query,
          {
            $push: {
              refered_users: newUserId
            },
            $inc: {
              refered_user_count: 1
            }
          },
          {},
          function(err) {
            if (err != null) {
              logger.warn(
                { err, referalId, newUserId },
                'something went wrong allocating referal'
              )
              return callback(err)
            }
            FeaturesUpdater.refreshFeatures(user._id, callback)
          }
        )
      } else {
        callback()
      }
    })
  }
}
