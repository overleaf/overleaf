import { db } from '../app/src/infrastructure/mongodb.js'
import minimist from 'minimist'
import _ from 'lodash'
import async from 'async'
import FeaturesUpdater from '../app/src/Features/Subscription/FeaturesUpdater.js'
import FeaturesHelper from '../app/src/Features/Subscription/FeaturesHelper.js'
import UserFeaturesUpdater from '../app/src/Features/Subscription/UserFeaturesUpdater.js'
import AnalyticsManager from '../app/src/Features/Analytics/AnalyticsManager.js'
import DropboxHandler from '../modules/dropbox/app/src/DropboxHandler.mjs'
import { OError } from '../app/src/Features/Errors/Errors.js'

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
      const daysSinceLastLoggedIn =
        (new Date() - user.lastLoggedIn) / 1000 / 3600 / 24
      ScriptLogger.allDaysSinceLastLoggedIn.push(daysSinceLastLoggedIn)
    }
  },

  printProgress: () => {
    console.warn(
      `Users checked: ${ScriptLogger.checkedUsersCount}. Mismatches: ${ScriptLogger.mismatchUsersCount}`
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
  },
}

const checkAndUpdateUser = (user, callback) =>
  FeaturesUpdater.computeFeatures(user._id, (error, freshFeatures) => {
    if (error) {
      return callback(error)
    }

    const mismatchReasons = FeaturesHelper.compareFeatures(
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

    const matchedFeatureSet = FeaturesHelper.getMatchedFeatureSet(freshFeatures)
    AnalyticsManager.setUserPropertyForUserInBackground(
      user._id,
      'feature-set',
      matchedFeatureSet
    )

    UserFeaturesUpdater.overrideFeatures(
      user._id,
      freshFeatures,
      (error, featuresChanged) => {
        if (error) {
          return callback(error)
        }
        if (
          mismatchReasons.dropbox !== undefined &&
          freshFeatures.dropbox === false
        ) {
          DropboxHandler.unlinkAccount(
            user._id,
            { sendEmail: false },
            error => {
              if (error) {
                return callback(
                  OError.tag(error, 'error unlinking dropbox', {
                    userId: user._id,
                  })
                )
              }
              console.log({ userId: user._id }, 'Unlinked dropbox')
              callback(null, featuresChanged)
            }
          )
        } else {
          callback(null, featuresChanged)
        }
      }
    )
  })

const checkAndUpdateUsers = (users, callback) =>
  async.eachLimit(users, ASYNC_LIMIT, checkAndUpdateUser, callback)

const loopForUsers = (skip, callback) => {
  db.users
    .find({})
    .project({ features: 1, lastLoggedIn: 1 })
    .sort({ _id: 1 })
    .skip(skip)
    .limit(FETCH_LIMIT)
    .toArray((error, users) => {
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
  const FORCE = argv.force !== undefined
  if (!FORCE) {
    console.log(
      'NOTE: features can be automatically refreshed on login (using `featuresEpoch`)\n' +
        'Consider incrementing settings.featuresEpoch instead of running this script.\n' +
        'If you really need to run this script, use refresh_features.mjs --force.'
    )
    process.exit(1)
  }
  if (!COMMIT) {
    console.warn('Doing dry run without --commit')
  }
  if (MONGO_SKIP) {
    console.warn(`Skipping first ${MONGO_SKIP} records`)
  }
}

setup()
run()
