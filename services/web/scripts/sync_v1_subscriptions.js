const {db} = require('../app/js/infrastructure/mongojs')
const FeaturesUpdater = require(
  '../app/js/Features/Subscription/FeaturesUpdater'
)
const V1SubscriptionManager = require(
  '../app/js/Features/Subscription/V1SubscriptionManager'
)
const async = require('async')
const logger = require('logger-sharelatex')
logger.logger.level('error')

db.users.find({
  'overleaf.id': { $exists: true }
}, {
  overleaf: 1
}, function (error, users) {
  if (error) throw error
  console.log('Found users:', users.length)
  async.mapSeries(users, function (user, callback) {
    console.log('refreshing in v2', user._id)
    FeaturesUpdater.refreshFeatures(user._id, false, function (error) {
      if (error) console.error('ERROR', error)
      console.log('refreshing in v1', user._id)
      V1SubscriptionManager.notifyV1OfFeaturesChange(
        user._id,
        function (error) {
          if (error) console.error('ERROR', error)
          callback()
        }
      )
    })
  }, function (error) {
    if (error) throw error
    console.log('FINISHED!')
    process.exit()
  })
})
