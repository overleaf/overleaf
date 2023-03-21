/* eslint-disable
    n/handle-callback-err,
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
let rclientSecondary
const { URL, URLSearchParams } = require('url')
const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const request = require('request').defaults({ timeout: 30 * 1000 })
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('clsi_cookie')
if (Settings.redis.clsi_cookie_secondary != null) {
  rclientSecondary = RedisWrapper.client('clsi_cookie_secondary')
}
const Cookie = require('cookie')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')

const clsiCookiesEnabled =
  (Settings.clsiCookie != null ? Settings.clsiCookie.key : undefined) != null &&
  Settings.clsiCookie.key.length !== 0

module.exports = function (backendGroup) {
  return {
    buildKey(projectId, userId) {
      if (backendGroup != null) {
        return `clsiserver:${backendGroup}:${projectId}:${userId}`
      } else {
        return `clsiserver:${projectId}:${userId}`
      }
    },

    _getServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      callback
    ) {
      if (callback == null) {
        callback = function () {}
      }
      return rclient.get(this.buildKey(projectId, userId), (err, serverId) => {
        if (err != null) {
          return callback(err)
        }
        if (serverId == null || serverId === '') {
          return this._populateServerIdViaRequest(
            projectId,
            userId,
            compileGroup,
            compileBackendClass,
            callback
          )
        } else {
          return callback(null, serverId)
        }
      })
    },

    _populateServerIdViaRequest(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      callback
    ) {
      if (callback == null) {
        callback = function () {}
      }
      const u = new URL(`${Settings.apis.clsi.url}/project/${projectId}/status`)
      u.search = new URLSearchParams({
        compileGroup,
        compileBackendClass,
      }).toString()
      request.post(u.href, (err, res, body) => {
        if (err != null) {
          OError.tag(err, 'error getting initial server id for project', {
            project_id: projectId,
          })
          return callback(err)
        }
        this.setServerId(
          projectId,
          userId,
          compileGroup,
          compileBackendClass,
          res,
          null,
          function (err, serverId) {
            if (err != null) {
              logger.warn(
                { err, projectId },
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

    checkIsLoadSheddingEvent(clsiserverid, compileGroup, compileBackendClass) {
      request.get(
        {
          url: `${Settings.apis.clsi.url}/instance-state`,
          qs: { clsiserverid, compileGroup, compileBackendClass },
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

    _getTTLInSeconds(clsiServerId) {
      return (clsiServerId || '').includes('-reg-')
        ? Settings.clsiCookie.ttlInSecondsRegular
        : Settings.clsiCookie.ttlInSeconds
    },

    setServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      response,
      previous,
      callback
    ) {
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
          this.buildKey(projectId, userId),
          this._getTTLInSeconds(previous),
          err => callback(err, undefined)
        )
      }
      if (!previous) {
        // Initial assignment of a user+project or after clearing cache.
        Metrics.inc('clsi-lb-assign-initial-backend')
      } else {
        this.checkIsLoadSheddingEvent(
          previous,
          compileGroup,
          compileBackendClass
        )
      }
      if (rclientSecondary != null) {
        this._setServerIdInRedis(
          rclientSecondary,
          projectId,
          userId,
          serverId,
          () => {}
        )
      }
      this._setServerIdInRedis(rclient, projectId, userId, serverId, err =>
        callback(err, serverId)
      )
    },

    _setServerIdInRedis(rclient, projectId, userId, serverId, callback) {
      if (callback == null) {
        callback = function () {}
      }
      rclient.setex(
        this.buildKey(projectId, userId),
        this._getTTLInSeconds(serverId),
        serverId,
        callback
      )
    },

    clearServerId(projectId, userId, callback) {
      if (callback == null) {
        callback = function () {}
      }
      if (!clsiCookiesEnabled) {
        return callback()
      }
      return rclient.del(this.buildKey(projectId, userId), callback)
    },

    getCookieJar(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      callback
    ) {
      if (callback == null) {
        callback = function () {}
      }
      if (!clsiCookiesEnabled) {
        return callback(null, request.jar(), undefined)
      }
      return this._getServerId(
        projectId,
        userId,
        compileGroup,
        compileBackendClass,
        (err, serverId) => {
          if (err != null) {
            OError.tag(err, 'error getting server id', {
              project_id: projectId,
            })
            return callback(err)
          }
          const serverCookie = request.cookie(
            `${Settings.clsiCookie.key}=${serverId}`
          )
          const jar = request.jar()
          jar.setCookie(serverCookie, Settings.apis.clsi.url)
          return callback(null, jar, serverId)
        }
      )
    },
  }
}
