/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import OError from '@overleaf/o-error'
import V1Api from './V1Api.js'
import logger from '@overleaf/logger'

let V1Handler

export default V1Handler = {
  authWithV1(email, password, callback) {
    return V1Api.request(
      {
        method: 'POST',
        url: '/api/v1/overleaf/login',
        json: { email, password },
        expectedStatusCodes: [403],
      },
      function (err, response, body) {
        if (err != null) {
          OError.tag(err, '[V1Handler] error while talking to v1 login api', {
            email,
          })
          return callback(err)
        }
        if ([200, 403].includes(response.statusCode)) {
          const isValid = body.valid
          const userProfile = body.user_profile
          logger.debug(
            {
              email,
              isValid,
              v1UserId: body?.user_profile?.id,
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

  doPasswordReset(v1UserId, password, callback) {
    return V1Api.request(
      {
        method: 'POST',
        url: '/api/v1/overleaf/reset_password',
        json: {
          user_id: v1UserId,
          password,
        },
        expectedStatusCodes: [200],
      },
      function (err, response, body) {
        if (err != null) {
          OError.tag(err, 'error while talking to v1 password reset api', {
            v1_user_id: v1UserId,
          })
          return callback(err, false)
        }
        if ([200].includes(response.statusCode)) {
          logger.debug(
            { v1UserId, changed: true },
            'got success response from v1 password reset api'
          )
          return callback(null, true)
        } else {
          err = new Error(
            `Unexpected status from v1 password reset api: ${response.statusCode}`
          )
          return callback(err, false)
        }
      }
    )
  },
}
