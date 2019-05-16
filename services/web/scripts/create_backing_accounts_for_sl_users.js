/**
 * create backing accounts for sl users without an overleaf.id
 *
 * run with:
 * node scripts/create_backing_accounts_for_sl_users.js --async-limit=8 --commit
 *
 * async-limit is the number of concurrent users to process.
 */

'use strict'

const SharelatexAuthHandler = require('../modules/overleaf-integration/app/js/SharelatexAuth/SharelatexAuthHandler')
const UserUpdater = require('../app/js/Features/User/UserUpdater')
const async = require('async')
const { db } = require('../app/js/infrastructure/mongojs')
const logger = require('logger-sharelatex')
const minimist = require('minimist')

logger.logger.level('error')

const argv = minimist(process.argv.slice(2))
const commit = argv.commit !== undefined
const asyncLimit = parseInt(argv['async-limit']) || 1

if (asyncLimit === 1) {
  console.log(`running in series. run with --async-limit=n to run in parallel.`)
}

if (!commit) {
  console.log(`doing dry run. run with --commit to save changes`)
}

const query = { 'overleaf.id': { $exists: false } }
const projection = {
  email: 1,
  first_name: 1,
  hashedPassword: 1,
  last_name: 1
}

db.users.find(query, projection, (err, users) => {
  if (err) throw err
  async.eachLimit(users, asyncLimit, createBackingAccount, err => {
    if (err) throw err
    console.log('DONE')
    process.exit()
  })
})

function createBackingAccount(user, cb) {
  console.log(
    `Creating backing account for id: ${user._id}, email: ${user.email}`
  )
  if (!commit) return cb()
  SharelatexAuthHandler.createBackingAccount(user, (err, v1Profile) => {
    if (err) {
      console.error(
        `Error creating backing account for id: ${user._id}`,
        err.stack
      )
      return cb()
    }
    console.log(
      `Created backing account for id: ${user._id}, ol id: ${
        v1Profile.id
      } -- updating user`
    )
    const update = {
      $set: {
        'overleaf.id': v1Profile.id,
        'ace.overallTheme': 'light-'
      }
    }
    UserUpdater.updateUser(user._id, update, err => {
      if (err) {
        console.error(`Error updating user id: ${user._id}`, err.stack)
        return cb()
      }
      console.log(`Updated user id: ${user._id}`)
      cb()
    })
  })
}
