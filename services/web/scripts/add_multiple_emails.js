const mongojs = require('../app/src/infrastructure/mongojs')
const { db } = mongojs
const async = require('async')
const minilist = require('minimist')

const updateUser = function(user, callback) {
  console.log(`Updating user ${user._id}`)
  const update = {
    $set: {
      emails: [
        {
          email: user.email,
          createdAt: new Date()
        }
      ]
    }
  }
  db.users.update({ _id: user._id }, update, callback)
}

const updateUsers = (users, callback) =>
  async.eachLimit(users, ASYNC_LIMIT, updateUser, function(error) {
    if (error) {
      callback(error)
      return
    }
    counter += users.length
    console.log(`${counter} users updated`)
    loopForUsers(callback)
  })

var loopForUsers = callback =>
  db.users
    .find({ emails: { $exists: false } }, { email: 1 })
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

let FETCH_LIMIT, ASYNC_LIMIT
var setup = function() {
  let args = minilist(process.argv.slice(2))
  FETCH_LIMIT = args.fetch ? args.fetch : 100
  ASYNC_LIMIT = args.async ? args.async : 10
}

setup()
run()
