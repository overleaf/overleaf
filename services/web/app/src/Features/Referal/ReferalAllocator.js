const OError = require('@overleaf/o-error')
const { User } = require('../../models/User')
const FeaturesUpdater = require('../Subscription/FeaturesUpdater')
const { callbackify } = require('@overleaf/promise-utils')

async function allocate(referalId, newUserId, referalSource, referalMedium) {
  if (referalId == null) {
    return null
  }

  const query = { referal_id: referalId }
  const user = await User.findOne(query, { _id: 1 }).exec()
  if (user == null || user._id == null) {
    return null
  }

  if (referalSource === 'bonus') {
    try {
      await User.updateOne(
        query,
        {
          $push: {
            refered_users: newUserId,
          },
          $inc: {
            refered_user_count: 1,
          },
        },
        {}
      ).exec()
    } catch (err) {
      OError.tag(err, 'something went wrong allocating referal', {
        referalId,
        newUserId,
      })
      throw err
    }

    return await FeaturesUpdater.promises.refreshFeatures(user._id, 'referral')
  }
}

module.exports = {
  allocate: callbackify(allocate),
  promises: {
    allocate,
  },
}
