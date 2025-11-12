import OError from '@overleaf/o-error'
import { User } from '../../models/User.mjs'
import FeaturesUpdater from '../Subscription/FeaturesUpdater.mjs'
import { callbackify } from '@overleaf/promise-utils'

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

export default {
  allocate: callbackify(allocate),
  promises: {
    allocate,
  },
}
