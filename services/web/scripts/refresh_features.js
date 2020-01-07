const { db } = require('../app/src/infrastructure/mongojs')
const minimist = require('minimist')
const _ = require('lodash')
const async = require('async')
const FeaturesUpdater = require('../app/src/Features/Subscription/FeaturesUpdater')
const UserFeaturesUpdater = require('../app/src/Features/Subscription/UserFeaturesUpdater')

const ScriptLogger = {
  checkedUsersCount: 0,
  mismatchUsersCount: 0,
  allDaysSinceLastLoggedIn: [],
  allMismatchReasons: {},

  recordMismatch: (user, mismatchReasons) => {
    const mismatchReasonsString = JSON.stringify(mismatchReasons)
    if (ScriptLogger.allMismatchReasons[mismatchReasonsString]) {
      ScriptLogger.allMismatchReasons[mismatchReasonsString].push(user._id)
    } else {
      ScriptLogger.allMismatchReasons[mismatchReasonsString] = [user._id]
    }

    ScriptLogger.mismatchUsersCount += 1

    if (user.lastLoggedIn) {
      let daysSinceLastLoggedIn =
        (new Date() - user.lastLoggedIn) / 1000 / 3600 / 24
      ScriptLogger.allDaysSinceLastLoggedIn.push(daysSinceLastLoggedIn)
    }
  },

  printProgress: () => {
    console.warn(
      `Users checked: ${ScriptLogger.checkedUsersCount}. Mismatches: ${
        ScriptLogger.mismatchUsersCount
      }`
    )
  },

  printSummary: () => {
    console.log('All Mismatch Reasons:', ScriptLogger.allMismatchReasons)
    console.log('Mismatch Users Count', ScriptLogger.mismatchUsersCount)
    console.log(
      'Average Last Logged In (Days):',
      _.sum(ScriptLogger.allDaysSinceLastLoggedIn) /
        ScriptLogger.allDaysSinceLastLoggedIn.length
    )
    console.log(
      'Recent Logged In (Last 7 Days):',
      _.filter(ScriptLogger.allDaysSinceLastLoggedIn, a => a < 7).length
    )
    console.log(
      'Recent Logged In (Last 30 Days):',
      _.filter(ScriptLogger.allDaysSinceLastLoggedIn, a => a < 30).length
    )
  }
}

const checkAndUpdateUser = (user, callback) =>
  FeaturesUpdater._computeFeatures(user._id, (error, freshFeatures) => {
    if (error) {
      return callback(error)
    }

    let mismatchReasons = FeaturesUpdater.compareFeatures(
      user.features,
      freshFeatures
    )
    if (Object.keys(mismatchReasons).length === 0) {
      // features are matching; nothing else to do
      return callback()
    }

    ScriptLogger.recordMismatch(user, mismatchReasons)

    if (!COMMIT) {
      // not saving features; nothing else to do
      return callback()
    }

    UserFeaturesUpdater.overrideFeatures(user._id, freshFeatures, callback)
  })

const checkAndUpdateUsers = (users, callback) =>
  async.eachLimit(users, ASYNC_LIMIT, checkAndUpdateUser, callback)

const loopForUsers = (skip, callback) => {
  db.users
    .find({}, { features: 1, lastLoggedIn: 1 })
    .sort('_id')
    .skip(skip)
    .limit(FETCH_LIMIT, (error, users) => {
      if (error) {
        return callback(error)
      }

      if (users.length === 0) {
        console.warn('DONE')
        return callback()
      }

      checkAndUpdateUsers(users, error => {
        if (error) {
          return callback(error)
        }
        ScriptLogger.checkedUsersCount += users.length
        retryCounter = 0
        ScriptLogger.printProgress()
        ScriptLogger.printSummary()
        loopForUsers(MONGO_SKIP + ScriptLogger.checkedUsersCount, callback)
      })
    })
}

let retryCounter = 0
const run = () =>
  loopForUsers(MONGO_SKIP + ScriptLogger.checkedUsersCount, error => {
    if (error) {
      if (retryCounter < 3) {
        console.error(error)
        retryCounter += 1
        console.warn(`RETRYING IN 60 SECONDS. (${retryCounter}/3)`)
        return setTimeout(run, 6000)
      }
      throw error
    }
    process.exit()
  })

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
