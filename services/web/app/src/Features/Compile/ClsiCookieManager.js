/* eslint-disable
    camelcase,
    node/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let rclient_secondary
const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const request = require('request').defaults({ timeout: 30 * 1000 })
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('clsi_cookie')
if (Settings.redis.clsi_cookie_secondary != null) {
  rclient_secondary = RedisWrapper.client('clsi_cookie_secondary')
}
const Cookie = require('cookie')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')

const clsiCookiesEnabled =
  (Settings.clsiCookie != null ? Settings.clsiCookie.key : undefined) != null &&
  Settings.clsiCookie.key.length !== 0

module.exports = function (backendGroup) {
  return {
    buildKey(project_id, user_id) {
      if (backendGroup != null) {
        return `clsiserver:${backendGroup}:${project_id}:${user_id}`
      } else {
        return `clsiserver:${project_id}:${user_id}`
      }
    },

    _getServerId(project_id, user_id, callback) {
      if (callback == null) {
        callback = function () {}
      }
      return rclient.get(
        this.buildKey(project_id, user_id),
        (err, serverId) => {
          if (err != null) {
            return callback(err)
          }
          if (serverId == null || serverId === '') {
            return this._populateServerIdViaRequest(
              project_id,
              user_id,
              callback
            )
          } else {
            return callback(null, serverId)
          }
        }
      )
    },

    _populateServerIdViaRequest(project_id, user_id, callback) {
      if (callback == null) {
        callback = function () {}
      }
      const url = `${Settings.apis.clsi.url}/project/${project_id}/status`
      request.post(url, (err, res, body) => {
        if (err != null) {
          OError.tag(err, 'error getting initial server id for project', {
            project_id,
          })
          return callback(err)
        }
        this.setServerId(
          project_id,
          user_id,
          res,
          null,
          function (err, serverId) {
            if (err != null) {
              logger.warn(
                { err, project_id },
                'error setting server id via populate request'
              )
            }
            return callback(err, serverId)
          }
        )
      })
    },

    _parseServerIdFromResponse(response) {
      const cookies = Cookie.parse(
        (response.headers['set-cookie'] != null
          ? response.headers['set-cookie'][0]
          : undefined) || ''
      )
      return cookies != null ? cookies[Settings.clsiCookie.key] : undefined
    },

    checkIsLoadSheddingEvent(clsiserverid) {
      request.get(
        {
          url: `${Settings.apis.clsi.url}/instance-state`,
          qs: { clsiserverid },
        },
        (err, res, body) => {
          if (err) {
            Metrics.inc('clsi-lb-switch-backend', 1, {
              status: 'error',
            })
            logger.warn({ err, clsiserverid }, 'cannot probe clsi VM')
            return
          }
          const isStillRunning =
            res.statusCode === 200 && body === `${clsiserverid},UP\n`
          Metrics.inc('clsi-lb-switch-backend', 1, {
            status: isStillRunning ? 'load-shedding' : 'cycle',
          })
        }
      )
    },

    setServerId(project_id, user_id, response, previous, callback) {
      if (callback == null) {
        callback = function () {}
      }
      if (!clsiCookiesEnabled) {
        return callback()
      }
      const serverId = this._parseServerIdFromResponse(response)
      if (serverId == null) {
        // We don't get a cookie back if it hasn't changed
        return rclient.expire(
          this.buildKey(project_id, user_id),
          Settings.clsiCookie.ttl,
          err => callback(err, undefined)
        )
      }
      if (!previous) {
        // Initial assignment of a user+project or after clearing cache.
        Metrics.inc('clsi-lb-assign-initial-backend')
      } else {
        this.checkIsLoadSheddingEvent(previous)
      }
      if (rclient_secondary != null) {
        this._setServerIdInRedis(
          rclient_secondary,
          project_id,
          user_id,
          serverId,
          () => {}
        )
      }
      this._setServerIdInRedis(rclient, project_id, user_id, serverId, err =>
        callback(err, serverId)
      )
    },

    _setServerIdInRedis(rclient, project_id, user_id, serverId, callback) {
      if (callback == null) {
        callback = function () {}
      }
      rclient.setex(
        this.buildKey(project_id, user_id),
        Settings.clsiCookie.ttl,
        serverId,
        callback
      )
    },

    clearServerId(project_id, user_id, callback) {
      if (callback == null) {
        callback = function () {}
      }
      if (!clsiCookiesEnabled) {
        return callback()
      }
      return rclient.del(this.buildKey(project_id, user_id), callback)
    },

    getCookieJar(project_id, user_id, callback) {
      if (callback == null) {
        callback = function () {}
      }
      if (!clsiCookiesEnabled) {
        return callback(null, request.jar(), undefined)
      }
      return this._getServerId(project_id, user_id, (err, serverId) => {
        if (err != null) {
          OError.tag(err, 'error getting server id', {
            project_id,
          })
          return callback(err)
        }
        const serverCookie = request.cookie(
          `${Settings.clsiCookie.key}=${serverId}`
        )
        const jar = request.jar()
        jar.setCookie(serverCookie, Settings.apis.clsi.url)
        return callback(null, jar, serverId)
      })
    },
  }
}
