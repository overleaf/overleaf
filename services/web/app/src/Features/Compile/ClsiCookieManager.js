const { URL, URLSearchParams } = require('url')
const OError = require('@overleaf/o-error')
const Settings = require('@overleaf/settings')
const request = require('request').defaults({ timeout: 30 * 1000 })
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const Cookie = require('cookie')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const { promisifyAll } = require('@overleaf/promise-utils')

const clsiCookiesEnabled = (Settings.clsiCookie?.key ?? '') !== ''

const rclient = RedisWrapper.client('clsi_cookie')
let rclientSecondary
if (Settings.redis.clsi_cookie_secondary != null) {
  rclientSecondary = RedisWrapper.client('clsi_cookie_secondary')
}

module.exports = function (backendGroup) {
  const cookieManager = {
    buildKey(projectId, userId) {
      if (backendGroup != null) {
        return `clsiserver:${backendGroup}:${projectId}:${userId}`
      } else {
        return `clsiserver:${projectId}:${userId}`
      }
    },

    getServerId(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      callback
    ) {
      if (!clsiCookiesEnabled) {
        return callback()
      }
      rclient.get(this.buildKey(projectId, userId), (err, serverId) => {
        if (err) {
          return callback(err)
        }
        if (serverId == null || serverId === '') {
          this._populateServerIdViaRequest(
            projectId,
            userId,
            compileGroup,
            compileBackendClass,
            callback
          )
        } else {
          callback(null, serverId)
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
      const u = new URL(`${Settings.apis.clsi.url}/project/${projectId}/status`)
      u.search = new URLSearchParams({
        compileGroup,
        compileBackendClass,
      }).toString()
      request.post(u.href, (err, res, body) => {
        if (err) {
          OError.tag(err, 'error getting initial server id for project', {
            project_id: projectId,
          })
          return callback(err)
        }
        if (!clsiCookiesEnabled) {
          return callback()
        }
        const serverId = this._parseServerIdFromResponse(res)
        this.setServerId(
          projectId,
          userId,
          compileGroup,
          compileBackendClass,
          serverId,
          null,
          function (err) {
            if (err) {
              logger.warn(
                { err, projectId },
                'error setting server id via populate request'
              )
            }
            callback(err, serverId)
          }
        )
      })
    },

    _parseServerIdFromResponse(response) {
      const cookies = Cookie.parse(response.headers['set-cookie']?.[0] || '')
      return cookies?.[Settings.clsiCookie.key]
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
      serverId,
      previous,
      callback
    ) {
      if (!clsiCookiesEnabled) {
        return callback()
      }
      if (serverId == null) {
        // We don't get a cookie back if it hasn't changed
        return rclient.expire(
          this.buildKey(projectId, userId),
          this._getTTLInSeconds(previous),
          err => callback(err)
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
        callback(err)
      )
    },

    _setServerIdInRedis(rclient, projectId, userId, serverId, callback) {
      rclient.setex(
        this.buildKey(projectId, userId),
        this._getTTLInSeconds(serverId),
        serverId,
        callback
      )
    },

    clearServerId(projectId, userId, callback) {
      if (!clsiCookiesEnabled) {
        return callback()
      }
      rclient.del(this.buildKey(projectId, userId), err => {
        if (err) {
          // redis errors need wrapping as the instance may be shared
          return callback(
            new OError(
              'Failed to clear clsi persistence',
              { projectId, userId },
              err
            )
          )
        } else {
          return callback()
        }
      })
    },

    getCookieJar(
      projectId,
      userId,
      compileGroup,
      compileBackendClass,
      callback
    ) {
      if (!clsiCookiesEnabled) {
        return callback(null, request.jar(), undefined)
      }
      this.getServerId(
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
          callback(null, jar, serverId)
        }
      )
    },
  }
  cookieManager.promises = promisifyAll(cookieManager, {
    without: [
      '_parseServerIdFromResponse',
      'checkIsLoadSheddingEvent',
      '_getTTLInSeconds',
    ],
    multiResult: {
      getCookieJar: ['jar', 'clsiServerId'],
    },
  })
  return cookieManager
}
