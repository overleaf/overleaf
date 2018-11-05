const { db } = require('../app/js/infrastructure/mongojs')
const FeaturesUpdater = require('../app/js/Features/Subscription/FeaturesUpdater')
const V1SubscriptionManager = require('../app/js/Features/Subscription/V1SubscriptionManager')
const async = require('async')
const logger = require('logger-sharelatex')
logger.logger.level('error')

const areFeaturesEqual = function(featuresA, featuresB) {
  for (const feature in featuresA) {
    if (featuresA[feature] !== featuresB[feature]) {
      return false
    }
  }
  return true
}

var outOfSyncUserCount = 0
var userCount = null

db.users.find(
  {
    'overleaf.id': { $exists: true }
  },
  {
    overleaf: 1,
    features: 1
  },
  function(error, users) {
    if (error) throw error
    console.log('USER COUNT', (userCount = users.length))
    async.mapSeries(
      users,
      function(user, callback) {
        console.log('REFRESHING IN v2', user._id)
        FeaturesUpdater.refreshFeatures(user._id, false, function(error) {
          if (error) console.error('ERROR', error)
          console.log('REFRESHING IN v1', user._id)
          V1SubscriptionManager.notifyV1OfFeaturesChange(user._id, function(
            error
          ) {
            if (error) console.error('ERROR', error)
            db.users.find(
              {
                _id: user._id
              },
              {
                features: 1
              },
              function(error, [updatedUser]) {
                if (error) throw error
                if (areFeaturesEqual(user.features, updatedUser.features)) {
                  console.log('UNCHANGED', user._id)
                } else {
                  console.log('MODIFIED', user._id)
                  outOfSyncUserCount = outOfSyncUserCount + 1
                }
                callback()
              }
            )
          })
        })
      },
      function(error) {
        if (error) throw error
        console.log('FINISHED!')
        console.log('OUT OF SYNC USERS', outOfSyncUserCount, '/', userCount)
        process.exit()
      }
    )
  }
)
