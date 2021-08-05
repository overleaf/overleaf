const { Subscription } = require('../../app/src/models/Subscription')
const RecurlyWrapper = require('../../app/src/Features/Subscription/RecurlyWrapper')
const SubscriptionUpdater = require('../../app/src/Features/Subscription/SubscriptionUpdater')
const async = require('async')
const minimist = require('minimist')

// make sure all `allMismatchReasons` are displayed in the output
const util = require('util')
util.inspect.defaultOptions.maxArrayLength = null

const ScriptLogger = {
  checkedSubscriptionsCount: 0,
  mismatchSubscriptionsCount: 0,
  allMismatchReasons: {},

  recordMismatch: (subscription, recurlySubscription) => {
    const mismatchReasons = {}
    if (subscription.planCode !== recurlySubscription.plan.plan_code) {
      mismatchReasons.recurlyPlan = recurlySubscription.plan.plan_code
      mismatchReasons.olPlan = subscription.planCode
    }
    if (recurlySubscription.state === 'expired') {
      mismatchReasons.state = 'expired'
    }

    if (!Object.keys(mismatchReasons).length) {
      return
    }

    ScriptLogger.mismatchSubscriptionsCount += 1
    const mismatchReasonsString = JSON.stringify(mismatchReasons)
    if (ScriptLogger.allMismatchReasons[mismatchReasonsString]) {
      ScriptLogger.allMismatchReasons[mismatchReasonsString].push(
        subscription._id
      )
    } else {
      ScriptLogger.allMismatchReasons[mismatchReasonsString] = [
        subscription._id,
      ]
    }
  },

  printProgress: () => {
    console.warn(
      `Subscriptions checked: ${ScriptLogger.checkedSubscriptionsCount}. Mismatches: ${ScriptLogger.mismatchSubscriptionsCount}`
    )
  },

  printSummary: () => {
    console.log('All Mismatch Reasons:', ScriptLogger.allMismatchReasons)
    console.log(
      'Mismatch Subscriptions Count',
      ScriptLogger.mismatchSubscriptionsCount
    )
  },
}

const slowCallback = callback => setTimeout(callback, 80)

const handleSyncSubscriptionError = (subscription, error, callback) => {
  console.warn(`Errors with subscription id=${subscription._id}:`, error)
  if (typeof error === 'string' && error.match(/429$/)) {
    return setTimeout(callback, 1000 * 60 * 5)
  }
  if (typeof error === 'string' && error.match(/5\d\d$/)) {
    return setTimeout(() => {
      syncSubscription(subscription, callback)
    }, 1000 * 60)
  }
  slowCallback(callback)
}

const syncSubscription = (subscription, callback) => {
  RecurlyWrapper.getSubscription(
    subscription.recurlySubscription_id,
    (error, recurlySubscription) => {
      if (error) {
        return handleSyncSubscriptionError(subscription, error, callback)
      }

      ScriptLogger.recordMismatch(subscription, recurlySubscription)

      if (!COMMIT) {
        return callback()
      }

      SubscriptionUpdater.updateSubscriptionFromRecurly(
        recurlySubscription,
        subscription,
        {},
        error => {
          if (error) {
            return handleSyncSubscriptionError(subscription, error, callback)
          }
          slowCallback(callback)
        }
      )
    }
  )
}

const syncSubscriptions = (subscriptions, callback) => {
  async.eachLimit(subscriptions, ASYNC_LIMIT, syncSubscription, callback)
}

const loopForSubscriptions = (skip, callback) => {
  Subscription.find({
    recurlySubscription_id: { $exists: true, $ne: '' },
  })
    .sort('_id')
    .skip(skip)
    .limit(FETCH_LIMIT)
    .exec((error, subscriptions) => {
      if (error) {
        return callback(error)
      }

      if (subscriptions.length === 0) {
        console.warn('DONE')
        return callback()
      }

      syncSubscriptions(subscriptions, error => {
        if (error) {
          return callback(error)
        }
        ScriptLogger.checkedSubscriptionsCount += subscriptions.length
        retryCounter = 0
        ScriptLogger.printProgress()
        ScriptLogger.printSummary()
        loopForSubscriptions(
          MONGO_SKIP + ScriptLogger.checkedSubscriptionsCount,
          callback
        )
      })
    })
}

let retryCounter = 0
const run = () =>
  loopForSubscriptions(
    MONGO_SKIP + ScriptLogger.checkedSubscriptionsCount,
    error => {
      if (error) {
        if (retryCounter < 3) {
          console.error(error)
          retryCounter += 1
          console.warn(`RETRYING IN 60 SECONDS. (${retryCounter}/3)`)
          return setTimeout(run, 60000)
        }
        throw error
      }
      process.exit()
    }
  )

let FETCH_LIMIT, ASYNC_LIMIT, COMMIT, MONGO_SKIP
const setup = () => {
  const argv = minimist(process.argv.slice(2))
  FETCH_LIMIT = argv.fetch ? argv.fetch : 100
  ASYNC_LIMIT = argv.async ? argv.async : 10
  MONGO_SKIP = argv.skip ? argv.skip : 0
  COMMIT = argv.commit !== undefined
  if (!COMMIT) {
    console.warn('Doing dry run without --commit')
  }
  if (MONGO_SKIP) {
    console.warn(`Skipping first ${MONGO_SKIP} records`)
  }
}

setup()
run()
