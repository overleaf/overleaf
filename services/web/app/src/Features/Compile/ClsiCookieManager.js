/* eslint-disable
    camelcase,
    handle-callback-err,
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
const Settings = require('settings-sharelatex')
const request = require('request')
const RedisWrapper = require('../../infrastructure/RedisWrapper')
const rclient = RedisWrapper.client('clsi_cookie')
if (Settings.redis.clsi_cookie_secondary != null) {
  rclient_secondary = RedisWrapper.client('clsi_cookie_secondary')
}
const Cookie = require('cookie')
const logger = require('logger-sharelatex')

const clsiCookiesEnabled =
  (Settings.clsiCookie != null ? Settings.clsiCookie.key : undefined) != null &&
  Settings.clsiCookie.key.length !== 0

module.exports = function(backendGroup) {
  return {
    buildKey(project_id) {
      if (backendGroup != null) {
        return `clsiserver:${backendGroup}:${project_id}`
      } else {
        return `clsiserver:${project_id}`
      }
    },

    _getServerId(project_id, callback) {
      if (callback == null) {
        callback = function(err, serverId) {}
      }
      return rclient.get(this.buildKey(project_id), (err, serverId) => {
        if (err != null) {
          return callback(err)
        }
        if (serverId == null || serverId === '') {
          return this._populateServerIdViaRequest(project_id, callback)
        } else {
          return callback(null, serverId)
        }
      })
    },

    _populateServerIdViaRequest(project_id, callback) {
      if (callback == null) {
        callback = function(err, serverId) {}
      }
      const url = `${Settings.apis.clsi.url}/project/${project_id}/status`
      return request.get(url, (err, res, body) => {
        if (err != null) {
          logger.warn(
            { err, project_id },
            'error getting initial server id for project'
          )
          return callback(err)
        }
        return this.setServerId(project_id, res, function(err, serverId) {
          if (err != null) {
            logger.warn(
              { err, project_id },
              'error setting server id via populate request'
            )
          }
          return callback(err, serverId)
        })
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

    setServerId(project_id, response, callback) {
      if (callback == null) {
        callback = function(err, serverId) {}
      }
      if (!clsiCookiesEnabled) {
        return callback()
      }
      const serverId = this._parseServerIdFromResponse(response)
      if (serverId == null) {
        // We don't get a cookie back if it hasn't changed
        return rclient.expire(
          this.buildKey(project_id),
          Settings.clsiCookie.ttl,
          callback
        )
      }
      if (rclient_secondary != null) {
        this._setServerIdInRedis(rclient_secondary, project_id, serverId)
      }
      return this._setServerIdInRedis(rclient, project_id, serverId, err =>
        callback(err, serverId)
      )
    },

    _setServerIdInRedis(rclient, project_id, serverId, callback) {
      if (callback == null) {
        callback = function(err) {}
      }
      const multi = rclient.multi()
      multi.set(this.buildKey(project_id), serverId)
      multi.expire(this.buildKey(project_id), Settings.clsiCookie.ttl)
      return multi.exec(callback)
    },

    clearServerId(project_id, callback) {
      if (callback == null) {
        callback = function(err) {}
      }
      if (!clsiCookiesEnabled) {
        return callback()
      }
      return rclient.del(this.buildKey(project_id), callback)
    },

    getCookieJar(project_id, callback) {
      if (callback == null) {
        callback = function(err, jar) {}
      }
      if (!clsiCookiesEnabled) {
        return callback(null, request.jar())
      }
      return this._getServerId(project_id, (err, serverId) => {
        if (err != null) {
          logger.warn({ err, project_id }, 'error getting server id')
          return callback(err)
        }
        const serverCookie = request.cookie(
          `${Settings.clsiCookie.key}=${serverId}`
        )
        const jar = request.jar()
        jar.setCookie(serverCookie, Settings.apis.clsi.url)
        return callback(null, jar)
      })
    }
  }
}
