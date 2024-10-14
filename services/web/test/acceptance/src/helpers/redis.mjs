/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import Settings from '@overleaf/settings'

import logger from '@overleaf/logger'
import Async from 'async'
import UserSessionsRedis from '../../../../app/src/Features/User/UserSessionsRedis.js'

// rclient = redis.createClient(Settings.redis.web)
const rclient = UserSessionsRedis.client()

export default {
  getUserSessions(user, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return rclient.smembers(
      UserSessionsRedis.sessionSetKey(user),
      (err, result) => callback(err, result)
    )
  },

  clearUserSessions(user, callback) {
    if (callback == null) {
      callback = function () {}
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    return rclient.smembers(sessionSetKey, (err, sessionKeys) => {
      if (err) {
        return callback(err)
      }
      if (sessionKeys.length === 0) {
        return callback(null)
      }
      const actions = sessionKeys.map(k => cb => rclient.del(k, err => cb(err)))
      return Async.series(actions, (err, results) =>
        rclient.srem(sessionSetKey, sessionKeys, err => {
          if (err) {
            return callback(err)
          }
          return callback(null)
        })
      )
    })
  },
}
