const mongojs = require('../app/src/infrastructure/mongojs')
const { db } = mongojs
const async = require('async')
const minilist = require('minimist')

const newTimeout = 240
const oldTimeoutLimits = { $gt: 60, $lt: 240 }

const updateUser = function(user, callback) {
  console.log(`Updating user ${user._id}`)
  const update = {
    $set: {
      'features.compileTimeout': newTimeout
    }
  }
  db.users.update(
    {
      _id: user._id,
      'features.compileTimeout': oldTimeoutLimits
    },
    update,
    callback
  )
}

const updateUsers = (users, callback) =>
  async.eachLimit(users, ASYNC_LIMIT, updateUser, function(error) {
    if (error) {
      callback(error)
      return
    }
    counter += users.length
    console.log(`${counter} users updated`)
    if (DO_ALL) {
      return loopForUsers(callback)
    } else {
      console.log('*** run again to continue updating ***')
      return callback()
    }
  })

var loopForUsers = callback =>
  db.users
    .find(
      { 'features.compileTimeout': oldTimeoutLimits },
      { 'features.compileTimeout': 1 }
    )
    .limit(FETCH_LIMIT, function(error, users) {
      if (error) {
        callback(error)
        return
      }
      if (users.length === 0) {
        console.log(`DONE (${counter} users updated)`)
        return callback()
      }
      updateUsers(users, callback)
    })

var counter = 0
var run = () =>
  loopForUsers(function(error) {
    if (error) {
      throw error
    }
    process.exit()
  })

let FETCH_LIMIT, ASYNC_LIMIT, DO_ALL
var setup = function() {
  let args = minilist(process.argv.slice(2))
  // --fetch N  get N users each time
  FETCH_LIMIT = args.fetch ? args.fetch : 100
  // --async M  run M updates in parallel
  ASYNC_LIMIT = args.async ? args.async : 10
  // --all means run to completion
  if (args.all) {
    if (args.fetch) {
      console.error('error: do not use --fetch with --all')
      process.exit(1)
    } else {
      DO_ALL = true
      // if we are updating for all users then ignore the fetch limit.
      FETCH_LIMIT = 0
      // A limit() value of 0 (i.e. .limit(0)) is equivalent to setting
      // no limit.
      // https://docs.mongodb.com/manual/reference/method/cursor.limit
    }
  }
}

setup()
run()
