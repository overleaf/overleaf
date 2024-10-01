const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const logger = require('@overleaf/logger')
const Async = require('async')
const _ = require('lodash')
const { promisify } = require('util')
const UserSessionsRedis = require('./UserSessionsRedis')
const rclient = UserSessionsRedis.client()

const UserSessionsManager = {
  // mimic the key used by the express sessions
  _sessionKey(sessionId) {
    return `sess:${sessionId}`
  },

  trackSession(user, sessionId, callback) {
    if (!user) {
      return callback(null)
    }
    if (!sessionId) {
      return callback(null)
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    const value = UserSessionsManager._sessionKey(sessionId)
    rclient
      .multi()
      .sadd(sessionSetKey, value)
      .pexpire(sessionSetKey, `${Settings.cookieSessionLength}`) // in milliseconds
      .exec(function (err, response) {
        if (err) {
          OError.tag(
            err,
            'error while adding session key to UserSessions set',
            {
              user_id: user._id,
              sessionSetKey,
            }
          )
          return callback(err)
        }
        UserSessionsManager._checkSessions(user, function () {})
        callback()
      })
  },

  untrackSession(user, sessionId, callback) {
    if (!callback) {
      callback = function () {}
    }
    if (!user) {
      return callback(null)
    }
    if (!sessionId) {
      return callback(null)
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    const value = UserSessionsManager._sessionKey(sessionId)
    rclient
      .multi()
      .srem(sessionSetKey, value)
      .pexpire(sessionSetKey, `${Settings.cookieSessionLength}`) // in milliseconds
      .exec(function (err, response) {
        if (err) {
          OError.tag(
            err,
            'error while removing session key from UserSessions set',
            {
              user_id: user._id,
              sessionSetKey,
            }
          )
          return callback(err)
        }
        UserSessionsManager._checkSessions(user, function () {})
        callback()
      })
  },

  getAllUserSessions(user, exclude, callback) {
    exclude = _.map(exclude, UserSessionsManager._sessionKey)
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    rclient.smembers(sessionSetKey, function (err, sessionKeys) {
      if (err) {
        OError.tag(err, 'error getting all session keys for user from redis', {
          user_id: user._id,
        })
        return callback(err)
      }
      sessionKeys = _.filter(sessionKeys, k => !_.includes(exclude, k))
      if (sessionKeys.length === 0) {
        logger.debug({ userId: user._id }, 'no other sessions found, returning')
        return callback(null, [])
      }

      Async.mapSeries(
        sessionKeys,
        (k, cb) => rclient.get(k, cb),
        function (err, sessions) {
          if (err) {
            OError.tag(err, 'error getting all sessions for user from redis', {
              user_id: user._id,
            })
            return callback(err)
          }

          const result = []
          for (let session of Array.from(sessions)) {
            if (!session) {
              continue
            }
            session = JSON.parse(session)
            let sessionUser = session.passport && session.passport.user
            if (!sessionUser) {
              sessionUser = session.user
            }

            result.push({
              ip_address: sessionUser.ip_address,
              session_created: sessionUser.session_created,
            })
          }

          callback(null, result)
        }
      )
    })
  },

  /**
   * @param {{_id: string}} user
   * @param {string | null | undefined} retainSessionID - the session ID to exclude from deletion
   * @param {(err: Error | null, data?: unknown) => void} callback
   */
  removeSessionsFromRedis(user, retainSessionID, callback) {
    if (!user) {
      return callback(
        new Error('bug: user not passed to removeSessionsFromRedis')
      )
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    rclient.smembers(sessionSetKey, function (err, sessionKeys) {
      if (err) {
        OError.tag(err, 'error getting contents of UserSessions set', {
          user_id: user._id,
          sessionSetKey,
        })
        return callback(err)
      }
      const keysToDelete = retainSessionID
        ? _.without(
            sessionKeys,
            UserSessionsManager._sessionKey(retainSessionID)
          )
        : sessionKeys
      if (keysToDelete.length === 0) {
        logger.debug(
          { userId: user._id },
          'no sessions in UserSessions set to delete, returning'
        )
        return callback(null, 0)
      }
      logger.debug(
        { userId: user._id, count: keysToDelete.length },
        'deleting sessions for user'
      )

      const deletions = keysToDelete.map(k => cb => rclient.del(k, cb))

      Async.series(deletions, function (err, _result) {
        if (err) {
          OError.tag(err, 'error revoking all sessions for user', {
            user_id: user._id,
            sessionSetKey,
          })
          return callback(err)
        }
        rclient.srem(sessionSetKey, keysToDelete, function (err) {
          if (err) {
            OError.tag(err, 'error removing session set for user', {
              user_id: user._id,
              sessionSetKey,
            })
            return callback(err)
          }
          callback(null, keysToDelete.length)
        })
      })
    })
  },

  touch(user, callback) {
    if (!user) {
      return callback(null)
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    rclient.pexpire(
      sessionSetKey,
      `${Settings.cookieSessionLength}`, // in milliseconds
      function (err, response) {
        if (err) {
          OError.tag(err, 'error while updating ttl on UserSessions set', {
            user_id: user._id,
          })
          return callback(err)
        }
        callback(null)
      }
    )
  },

  _checkSessions(user, callback) {
    if (!user) {
      return callback(null)
    }
    const sessionSetKey = UserSessionsRedis.sessionSetKey(user)
    rclient.smembers(sessionSetKey, function (err, sessionKeys) {
      if (err) {
        OError.tag(err, 'error getting contents of UserSessions set', {
          user_id: user._id,
          sessionSetKey,
        })
        return callback(err)
      }
      Async.series(
        sessionKeys.map(
          key => next =>
            rclient.get(key, function (err, val) {
              if (err) {
                return next(err)
              }
              if (!val) {
                rclient.srem(sessionSetKey, key, function (err, result) {
                  return next(err)
                })
              } else {
                next()
              }
            })
        ),
        function (err, results) {
          callback(err)
        }
      )
    })
  },
}

UserSessionsManager.promises = {
  getAllUserSessions: promisify(UserSessionsManager.getAllUserSessions),
  removeSessionsFromRedis: (user, retainSessionID = null) =>
    promisify(UserSessionsManager.removeSessionsFromRedis)(
      user,
      retainSessionID
    ),
  untrackSession: promisify(UserSessionsManager.untrackSession),
}

module.exports = UserSessionsManager
