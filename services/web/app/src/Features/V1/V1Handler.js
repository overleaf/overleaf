/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
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
let V1Handler
const V1Api = require('./V1Api')
const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

module.exports = V1Handler = {
  authWithV1(email, password, callback) {
    if (callback == null) {
      callback = function(err, isValid, v1Profile) {}
    }
    return V1Api.request(
      {
        method: 'POST',
        url: '/api/v1/sharelatex/login',
        json: { email, password },
        expectedStatusCodes: [403]
      },
      function(err, response, body) {
        if (err != null) {
          logger.warn(
            { email, err },
            '[V1Handler] error while talking to v1 login api'
          )
          return callback(err)
        }
        if ([200, 403].includes(response.statusCode)) {
          const isValid = body.valid
          const userProfile = body.user_profile
          logger.log(
            {
              email,
              isValid,
              v1UserId: __guard__(
                body != null ? body.user_profile : undefined,
                x => x.id
              )
            },
            '[V1Handler] got response from v1 login api'
          )
          return callback(null, isValid, userProfile)
        } else {
          err = new Error(
            `Unexpected status from v1 login api: ${response.statusCode}`
          )
          return callback(err)
        }
      }
    )
  },

  doPasswordReset(v1_user_id, password, callback) {
    if (callback == null) {
      callback = function(err, created) {}
    }
    logger.log({ v1_user_id }, 'sending password reset request to v1 login api')
    return V1Api.request(
      {
        method: 'POST',
        url: '/api/v1/sharelatex/reset_password',
        json: {
          user_id: v1_user_id,
          password
        },
        expectedStatusCodes: [200]
      },
      function(err, response, body) {
        if (err != null) {
          logger.warn(
            { v1_user_id, err },
            'error while talking to v1 password reset api'
          )
          return callback(err, false)
        }
        if ([200].includes(response.statusCode)) {
          logger.log(
            { v1_user_id, changed: true },
            'got success response from v1 password reset api'
          )
          return callback(null, true)
        } else {
          err = new Error(
            `Unexpected status from v1 password reset api: ${
              response.statusCode
            }`
          )
          return callback(err, false)
        }
      }
    )
  },

  getDocExported(token, callback) {
    // default to not exported
    if (callback == null) {
      callback = function(err, info) {}
    }
    if ((Settings.apis != null ? Settings.apis.v1 : undefined) == null) {
      return callback(null, {
        exported: false,
        exporting: false
      })
    }

    return V1Api.request(
      { url: `/api/v1/sharelatex/docs/${token}/exported_to_v2` },
      function(err, response, body) {
        if (err != null) {
          return callback(err)
        }
        return callback(null, body)
      }
    )
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
