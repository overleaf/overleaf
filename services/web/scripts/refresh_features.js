const { db } = require('../app/src/infrastructure/mongojs')
const minimist = require('minimist')
const _ = require('lodash')
const async = require('async')
const FeaturesUpdater = require('../app/src/Features/Subscription/FeaturesUpdater')
const UserFeaturesUpdater = require('../app/src/Features/Subscription/UserFeaturesUpdater')

const getMismatchReasons = (currentFeatures, expectedFeatures) => {
  currentFeatures = _.clone(currentFeatures)
  expectedFeatures = _.clone(expectedFeatures)
  if (_.isEqual(currentFeatures, expectedFeatures)) {
    return {}
  }

  let mismatchReasons = {}
  Object.keys(currentFeatures)
    .sort()
    .forEach(key => {
      if (expectedFeatures[key] !== currentFeatures[key]) {
        mismatchReasons[key] = expectedFeatures[key]
      }
    })

  if (mismatchReasons.compileTimeout) {
    // store the compile timeout difference instead of the new compile timeout
    mismatchReasons.compileTimeout =
      expectedFeatures.compileTimeout - currentFeatures.compileTimeout
  }

  if (mismatchReasons.collaborators) {
    // store the collaborators difference instead of the new number only
    // replace -1 by 100 to make it clearer
    if (expectedFeatures.collaborators === -1) {
      expectedFeatures.collaborators = 100
    }
    if (currentFeatures.collaborators === -1) {
      currentFeatures.collaborators = 100
    }
    mismatchReasons.collaborators =
      expectedFeatures.collaborators - currentFeatures.collaborators
  }

  return mismatchReasons
}

const recordMismatch = (user, mismatchReasons) => {
  const mismatchReasonsString = JSON.stringify(mismatchReasons)
  if (allMismatchReasons[mismatchReasonsString]) {
    allMismatchReasons[mismatchReasonsString] += 1
  } else {
    allMismatchReasons[mismatchReasonsString] = 1
  }

  mismatchUsersCount += 1

  if (user.lastLoggedIn) {
    let daysSinceLastLoggedIn =
      (new Date() - user.lastLoggedIn) / 1000 / 3600 / 24
    allDaysSinceLastLoggedIn.push(daysSinceLastLoggedIn)
  }
}

const checkAndUpdateUser = (user, callback) =>
  FeaturesUpdater._computeFeatures(user._id, (error, freshFeatures) => {
    if (error) {
      return callback(error)
    }

    let mismatchReasons = getMismatchReasons(user.features, freshFeatures)
    if (Object.keys(mismatchReasons).length === 0) {
      // features are matching; nothing else to do
      return callback()
    }

    recordMismatch(user, mismatchReasons)

    if (!COMMIT) {
      // not saving features; nothing else to do
      return callback()
    }

    UserFeaturesUpdater.overrideFeatures(user._id, freshFeatures, callback)
  })

const updateUsers = (users, callback) =>
  async.eachLimit(users, ASYNC_LIMIT, checkAndUpdateUser, error => {
    if (error) {
      return callback(error)
    }
    checkedUsersCount += users.length
    console.log(
      `Users checked: ${checkedUsersCount}. Mismatches: ${mismatchUsersCount}`
    )
    callback()
  })

const loopForUsers = (lastUserId, callback) => {
  const query = {}
  if (lastUserId) {
    query['_id'] = { $gt: lastUserId }
  }
  db.users
    .find(query, { features: 1, lastLoggedIn: 1 })
    .sort('_id')
    .limit(FETCH_LIMIT, (error, users) => {
      if (error) {
        return callback(error)
      }

      if (users.length === 0) {
        console.log('DONE')
        return callback()
      }

      updateUsers(users, error => {
        if (error) {
          return callback(error)
        }
        const lastUserId = users[users.length - 1]._id
        loopForUsers(lastUserId, callback)
      })
    })
}

const printSummary = () => {
  console.log({ allMismatchReasons })
  console.log(
    'Average Last Logged In (Days):',
    _.sum(allDaysSinceLastLoggedIn) / allDaysSinceLastLoggedIn.length
  )
  console.log(
    'Recent Logged In (Last 7 Days):',
    _.filter(allDaysSinceLastLoggedIn, a => a < 7).length
  )
  console.log(
    'Recent Logged In (Last 30 Days):',
    _.filter(allDaysSinceLastLoggedIn, a => a < 30).length
  )
}

let checkedUsersCount = 0
let mismatchUsersCount = 0
let allDaysSinceLastLoggedIn = []
let allMismatchReasons = {}
const run = () =>
  loopForUsers(null, error => {
    if (error) {
      throw error
    }
    printSummary()
    process.exit()
  })

let FETCH_LIMIT, ASYNC_LIMIT, COMMIT
const setup = () => {
  const argv = minimist(process.argv.slice(2))
  FETCH_LIMIT = argv.fetch ? argv.fetch : 100
  ASYNC_LIMIT = argv.async ? argv.async : 10
  COMMIT = argv.commit !== undefined
  if (!COMMIT) {
    console.log('Doing dry run without --commit')
  }
}

setup()
run()
