/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UserSessionsManager
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const Async = require('async')
const _ = require('underscore')
const UserSessionsRedis = require('./UserSessionsRedis')
const rclient = UserSessionsRedis.client()

module.exports = UserSessionsManager = {
  // mimic the key used by the express sessions
  _sessionKey(sessionId) {
    return `sess:${sessionId}`
  },

  trackSession(user, sessionId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (user == null) {
      logger.log({ sessionId }, 'no user to track, returning')
      return callback(null)
    }
    if (sessionId == null) {
      logger.log({ user_id: user._id }, 'no sessionId to track, returning')
      return callback(null)
    }
    logger.log({ user_id: user._id, sessionId }, 'onLogin handler')
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    const value = UserSessionsManager._sessionKey(sessionId)
    return rclient
      .multi()
      .sadd(sessionSetKey, value)
      .pexpire(sessionSetKey, `${Settings.cookieSessionLength}`) // in milliseconds
      .exec(function(err, response) {
        if (err != null) {
          logger.warn(
            { err, user_id: user._id, sessionSetKey },
            'error while adding session key to UserSessions set'
          )
          return callback(err)
        }
        UserSessionsManager._checkSessions(user, function() {})
        return callback()
      })
  },

  untrackSession(user, sessionId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (user == null) {
      logger.log({ sessionId }, 'no user to untrack, returning')
      return callback(null)
    }
    if (sessionId == null) {
      logger.log({ user_id: user._id }, 'no sessionId to untrack, returning')
      return callback(null)
    }
    logger.log({ user_id: user._id, sessionId }, 'onLogout handler')
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    const value = UserSessionsManager._sessionKey(sessionId)
    return rclient
      .multi()
      .srem(sessionSetKey, value)
      .pexpire(sessionSetKey, `${Settings.cookieSessionLength}`) // in milliseconds
      .exec(function(err, response) {
        if (err != null) {
          logger.warn(
            { err, user_id: user._id, sessionSetKey },
            'error while removing session key from UserSessions set'
          )
          return callback(err)
        }
        UserSessionsManager._checkSessions(user, function() {})
        return callback()
      })
  },

  getAllUserSessions(user, exclude, callback) {
    if (callback == null) {
      callback = function(err, sessionKeys) {}
    }
    exclude = _.map(exclude, UserSessionsManager._sessionKey)
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    return rclient.smembers(sessionSetKey, function(err, sessionKeys) {
      if (err != null) {
        logger.warn(
          { user_id: user._id },
          'error getting all session keys for user from redis'
        )
        return callback(err)
      }
      sessionKeys = _.filter(sessionKeys, k => !_.contains(exclude, k))
      if (sessionKeys.length === 0) {
        logger.log({ user_id: user._id }, 'no other sessions found, returning')
        return callback(null, [])
      }

      return Async.mapSeries(
        sessionKeys,
        (k, cb) => rclient.get(k, cb),
        function(err, sessions) {
          if (err != null) {
            logger.warn(
              { user_id: user._id },
              'error getting all sessions for user from redis'
            )
            return callback(err)
          }

          const result = []
          for (let session of Array.from(sessions)) {
            if (session === null) {
              continue
            }
            session = JSON.parse(session)
            const session_user =
              (session != null ? session.user : undefined) ||
              __guard__(
                session != null ? session.passport : undefined,
                x => x.user
              )
            result.push({
              ip_address: session_user.ip_address,
              session_created: session_user.session_created
            })
          }

          return callback(null, result)
        }
      )
    })
  },

  revokeAllUserSessions(user, retain, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (retain == null) {
      retain = []
    }
    retain = retain.map(i => UserSessionsManager._sessionKey(i))
    if (user == null) {
      logger.log({}, 'no user to revoke sessions for, returning')
      return callback(null)
    }
    logger.log({ user_id: user._id }, 'revoking all existing sessions for user')
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    return rclient.smembers(sessionSetKey, function(err, sessionKeys) {
      if (err != null) {
        logger.warn(
          { err, user_id: user._id, sessionSetKey },
          'error getting contents of UserSessions set'
        )
        return callback(err)
      }
      const keysToDelete = _.filter(
        sessionKeys,
        k => !Array.from(retain).includes(k)
      )
      if (keysToDelete.length === 0) {
        logger.log(
          { user_id: user._id },
          'no sessions in UserSessions set to delete, returning'
        )
        return callback(null)
      }
      logger.log(
        { user_id: user._id, count: keysToDelete.length },
        'deleting sessions for user'
      )

      const deletions = keysToDelete.map(k => cb => rclient.del(k, cb))

      return Async.series(deletions, function(err, _result) {
        if (err != null) {
          logger.warn(
            { err, user_id: user._id, sessionSetKey },
            'errror revoking all sessions for user'
          )
          return callback(err)
        }
        return rclient.srem(sessionSetKey, keysToDelete, function(err) {
          if (err != null) {
            logger.warn(
              { err, user_id: user._id, sessionSetKey },
              'error removing session set for user'
            )
            return callback(err)
          }
          return callback(null)
        })
      })
    })
  },

  touch(user, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (user == null) {
      logger.log({}, 'no user to touch sessions for, returning')
      return callback(null)
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    return rclient.pexpire(
      sessionSetKey,
      `${Settings.cookieSessionLength}`, // in milliseconds
      function(err, response) {
        if (err != null) {
          logger.warn(
            { err, user_id: user._id },
            'error while updating ttl on UserSessions set'
          )
          return callback(err)
        }
        return callback(null)
      }
    )
  },

  _checkSessions(user, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    if (user == null) {
      logger.log({}, 'no user, returning')
      return callback(null)
    }
    logger.log({ user_id: user._id }, 'checking sessions for user')
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    return rclient.smembers(sessionSetKey, function(err, sessionKeys) {
      if (err != null) {
        logger.warn(
          { err, user_id: user._id, sessionSetKey },
          'error getting contents of UserSessions set'
        )
        return callback(err)
      }
      logger.log(
        { user_id: user._id, count: sessionKeys.length },
        'checking sessions for user'
      )
      return Async.series(
        sessionKeys.map(key => next =>
          rclient.get(key, function(err, val) {
            if (err != null) {
              return next(err)
            }
            if (val == null) {
              logger.log(
                { user_id: user._id, key },
                '>> removing key from UserSessions set'
              )
              return rclient.srem(sessionSetKey, key, function(err, result) {
                if (err != null) {
                  return next(err)
                }
                return next(null)
              })
            } else {
              return next()
            }
          })
        ),
        function(err, results) {
          logger.log({ user_id: user._id }, 'done checking sessions for user')
          return callback(err)
        }
      )
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
