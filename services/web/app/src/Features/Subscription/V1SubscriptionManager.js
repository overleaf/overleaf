/* eslint-disable
    node/handle-callback-err,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let V1SubscriptionManager
const UserGetter = require('../User/UserGetter')
const request = require('requestretry')
const settings = require('@overleaf/settings')
const { V1ConnectionError, NotFoundError } = require('../Errors/Errors')
const { promisifyAll } = require('../../util/promises')

module.exports = V1SubscriptionManager = {
  getSubscriptionsFromV1(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'GET',
        url(v1Id) {
          return `/api/v1/sharelatex/users/${v1Id}/subscriptions`
        },
      },
      callback
    )
  },

  getSubscriptionStatusFromV1(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'GET',
        url(v1Id) {
          return `/api/v1/sharelatex/users/${v1Id}/subscription_status`
        },
      },
      callback
    )
  },

  cancelV1Subscription(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'DELETE',
        url(v1Id) {
          return `/api/v1/sharelatex/users/${v1Id}/subscription`
        },
      },
      callback
    )
  },

  v1IdForUser(userId, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return UserGetter.getUser(
      userId,
      { 'overleaf.id': 1 },
      function (err, user) {
        if (err != null) {
          return callback(err)
        }
        const v1Id = __guard__(
          user != null ? user.overleaf : undefined,
          x => x.id
        )

        return callback(null, v1Id)
      }
    )
  },

  // v1 accounts created before migration to v2 had github and mendeley for free
  // but these are now paid-for features for new accounts (v1id > cutoff)
  getGrandfatheredFeaturesForV1User(v1Id) {
    const cutoff = settings.v1GrandfatheredFeaturesUidCutoff
    if (cutoff == null) {
      return {}
    }
    if (v1Id == null) {
      return {}
    }

    if (v1Id < cutoff) {
      return settings.v1GrandfatheredFeatures || {}
    } else {
      return {}
    }
  },

  _v1Request(userId, options, callback) {
    if (callback == null) {
      callback = function () {}
    }
    if (!settings.apis.v1.url) {
      return callback(null, null)
    }

    return V1SubscriptionManager.v1IdForUser(userId, function (err, v1Id) {
      if (err != null) {
        return callback(err)
      }
      if (v1Id == null) {
        return callback(null, null, null)
      }
      const url = options.url(v1Id)
      const requestOptions = {
        baseUrl: settings.apis.v1.url,
        url,
        method: options.method,
        auth: {
          user: settings.apis.v1.user,
          pass: settings.apis.v1.pass,
          sendImmediately: true,
        },
        json: true,
        timeout: settings.apis.v1.timeout,
      }
      if (options.method === 'GET') {
        requestOptions.maxAttempts = 3
        requestOptions.retryDelay = 500
      } else {
        requestOptions.maxAttempts = 0
      }
      request(requestOptions, function (error, response, body) {
        if (error != null) {
          return callback(
            new V1ConnectionError({
              message: 'no v1 connection',
              info: { url },
            }).withCause(error)
          )
        }
        if (response && response.statusCode >= 500) {
          return callback(
            new V1ConnectionError({
              message: 'error from v1',
              info: {
                status: response.statusCode,
                body: body,
              },
            })
          )
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          return callback(null, body, v1Id)
        } else {
          if (response.statusCode === 404) {
            return callback(new NotFoundError(`v1 user not found: ${userId}`))
          } else {
            return callback(
              new Error(
                `non-success code from v1: ${response.statusCode} ${
                  options.method
                } ${options.url(v1Id)}`
              )
            )
          }
        }
      })
    })
  },
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

module.exports.promises = promisifyAll(module.exports, {
  without: ['getGrandfatheredFeaturesForV1User'],
})
