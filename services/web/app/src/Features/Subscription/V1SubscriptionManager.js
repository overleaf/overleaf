/* eslint-disable
    handle-callback-err,
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
const request = require('request')
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const { V1ConnectionError, NotFoundError } = require('../Errors/Errors')

module.exports = V1SubscriptionManager = {
  // Returned planCode = 'v1_pro' | 'v1_pro_plus' | 'v1_student' | 'v1_free' | null
  // For this to work, we need plans in settings with plan-codes:
  //   - 'v1_pro'
  //   - 'v1_pro_plus'
  //   - 'v1_student'
  //   - 'v1_free'
  getPlanCodeFromV1(userId, callback) {
    if (callback == null) {
      callback = function(err, planCode, v1Id) {}
    }
    logger.log({ userId }, '[V1SubscriptionManager] fetching v1 plan for user')
    return V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'GET',
        url(v1Id) {
          return `/api/v1/sharelatex/users/${v1Id}/plan_code`
        }
      },
      function(error, body, v1Id) {
        if (error != null) {
          return callback(error)
        }
        let planName = body != null ? body.plan_name : undefined
        logger.log(
          { userId, planName, body },
          '[V1SubscriptionManager] fetched v1 plan for user'
        )
        if (['pro', 'pro_plus', 'student', 'free'].includes(planName)) {
          planName = `v1_${planName}`
        } else {
          // Throw away 'anonymous', etc as being equivalent to null
          planName = null
        }
        return callback(null, planName, v1Id)
      }
    )
  },

  getSubscriptionsFromV1(userId, callback) {
    if (callback == null) {
      callback = function(err, subscriptions, v1Id) {}
    }
    return V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'GET',
        url(v1Id) {
          return `/api/v1/sharelatex/users/${v1Id}/subscriptions`
        }
      },
      callback
    )
  },

  getSubscriptionStatusFromV1(userId, callback) {
    if (callback == null) {
      callback = function(err, status) {}
    }
    return V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'GET',
        url(v1Id) {
          return `/api/v1/sharelatex/users/${v1Id}/subscription_status`
        }
      },
      callback
    )
  },

  cancelV1Subscription(userId, callback) {
    if (callback == null) {
      callback = function(err) {}
    }
    return V1SubscriptionManager._v1Request(
      userId,
      {
        method: 'DELETE',
        url(v1Id) {
          return `/api/v1/sharelatex/users/${v1Id}/subscription`
        }
      },
      callback
    )
  },

  v1IdForUser(userId, callback) {
    if (callback == null) {
      callback = function(err, v1Id) {}
    }
    return UserGetter.getUser(userId, { 'overleaf.id': 1 }, function(
      err,
      user
    ) {
      if (err != null) {
        return callback(err)
      }
      const v1Id = __guard__(
        user != null ? user.overleaf : undefined,
        x => x.id
      )
      if (v1Id == null) {
        logger.log(
          { userId },
          '[V1SubscriptionManager] no v1 id found for user'
        )
      }

      return callback(null, v1Id)
    })
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
      callback = function(err, body, v1Id) {}
    }
    if (!settings.apis.v1.url) {
      return callback(null, null)
    }

    return V1SubscriptionManager.v1IdForUser(userId, function(err, v1Id) {
      if (err != null) {
        return callback(err)
      }
      if (v1Id == null) {
        return callback(null, null, null)
      }
      return request(
        {
          baseUrl: settings.apis.v1.url,
          url: options.url(v1Id),
          method: options.method,
          auth: {
            user: settings.apis.v1.user,
            pass: settings.apis.v1.pass,
            sendImmediately: true
          },
          json: true,
          timeout: 15 * 1000
        },
        function(error, response, body) {
          if (error != null) {
            // Specially handle no connection err, so warning can be shown
            if (error.code === 'ECONNREFUSED') {
              error = new V1ConnectionError('No V1 connection')
            }
            return callback(error)
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
