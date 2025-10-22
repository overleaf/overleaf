let V1SubscriptionManager
const UserGetter = require('../User/UserGetter')
const request = require('requestretry')
const settings = require('@overleaf/settings')
const { V1ConnectionError, NotFoundError } = require('../Errors/Errors')
const { promisifyAll } = require('@overleaf/promise-utils')

module.exports = V1SubscriptionManager = {
  cancelV1Subscription(userId, callback) {
    V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'DELETE',
        url(v1Id) {
          return `/api/v1/overleaf/users/${v1Id}/subscription`
        },
      },
      callback
    )
  },

  v1IdForUser(userId, callback) {
    UserGetter.getUser(userId, { 'overleaf.id': 1 }, function (err, user) {
      if (err) {
        return callback(err)
      }
      const v1Id = user?.overleaf?.id
      callback(null, v1Id)
    })
  },

  // v1 accounts created before migration to v2 had github and mendeley for free
  // but these are now paid-for features for new accounts (v1id > cutoff)
  getGrandfatheredFeaturesForV1User(v1Id) {
    const cutoff = settings.v1GrandfatheredFeaturesUidCutoff
    if (!cutoff) {
      return {}
    }
    if (!v1Id) {
      return {}
    }

    if (v1Id < cutoff) {
      return settings.v1GrandfatheredFeatures || {}
    } else {
      return {}
    }
  },

  _v1Request(userId, options, callback) {
    if (!settings.apis.v1.url) {
      return callback(null, null)
    }

    V1SubscriptionManager.v1IdForUser(userId, function (err, v1Id) {
      if (err) {
        return callback(err)
      }
      if (!v1Id) {
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
        if (error) {
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
                body,
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

module.exports.promises = promisifyAll(module.exports, {
  without: ['getGrandfatheredFeaturesForV1User'],
})
