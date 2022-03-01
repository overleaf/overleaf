/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let LockManager
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const Lockfile = require('lockfile') // from https://github.com/npm/lockfile
const Errors = require('./Errors')
const fs = require('fs')
const Path = require('path')
module.exports = LockManager = {
  LOCK_TEST_INTERVAL: 1000, // 50ms between each test of the lock
  MAX_LOCK_WAIT_TIME: 15000, // 10s maximum time to spend trying to get the lock
  LOCK_STALE: 5 * 60 * 1000, // 5 mins time until lock auto expires

  runWithLock(path, runner, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const lockOpts = {
      wait: this.MAX_LOCK_WAIT_TIME,
      pollPeriod: this.LOCK_TEST_INTERVAL,
      stale: this.LOCK_STALE,
    }
    return Lockfile.lock(path, lockOpts, function (error) {
      if ((error != null ? error.code : undefined) === 'EEXIST') {
        return callback(new Errors.AlreadyCompilingError('compile in progress'))
      } else if (error != null) {
        return fs.lstat(path, (statLockErr, statLock) =>
          fs.lstat(Path.dirname(path), (statDirErr, statDir) =>
            fs.readdir(Path.dirname(path), function (readdirErr, readdirDir) {
              logger.err(
                {
                  error,
                  path,
                  statLock,
                  statLockErr,
                  statDir,
                  statDirErr,
                  readdirErr,
                  readdirDir,
                },
                'unable to get lock'
              )
              return callback(error)
            })
          )
        )
      } else {
        return runner((error1, ...args) =>
          Lockfile.unlock(path, function (error2) {
            error = error1 || error2
            if (error != null) {
              return callback(error)
            }
            return callback(null, ...Array.from(args))
          })
        )
      }
    })
  },
}
