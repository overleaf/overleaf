const OError = require('@overleaf/o-error')
const { User } = require('../../models/User')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const { promisify } = require('../../util/promises')

function allocate(
  referalId,
  newUserId,
  referalSource,
  referalMedium,
  callback
) {
  if (callback == null) {
    callback = function () {}
  }
  if (referalId == null) {
    return callback(null)
  }

  const query = { referal_id: referalId }
  User.findOne(query, { _id: 1 }, function (error, user) {
    if (error != null) {
      return callback(error)
    }
    if (user == null || user._id == null) {
      return callback(null)
    }

    if (referalSource === 'bonus') {
      User.updateOne(
        query,
        {
          $push: {
            refered_users: newUserId,
          },
          $inc: {
            refered_user_count: 1,
          },
        },
        {},
        function (err) {
          if (err != null) {
            OError.tag(err, 'something went wrong allocating referal', {
              referalId,
              newUserId,
            })
            return callback(err)
          }
          FeaturesUpdater.refreshFeatures(user._id, 'referral', callback)
        }
      )
    } else {
      callback()
    }
  })
}

module.exports = {
  allocate,
  promises: {
    allocate: promisify(allocate),
  },
}
