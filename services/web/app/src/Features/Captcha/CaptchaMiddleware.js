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
let CaptchaMiddleware
const request = require('request')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')

module.exports = CaptchaMiddleware = {
  validateCaptcha(action) {
    return function(req, res, next) {
      if (
        (Settings.recaptcha != null ? Settings.recaptcha.siteKey : undefined) ==
        null
      ) {
        return next()
      }
      const inviteAndCaptchaDisabled =
        action === 'invite' && Settings.recaptcha.disabled.invite
      const registerAndCaptchaDisabled =
        action === 'register' && Settings.recaptcha.disabled.register
      if (inviteAndCaptchaDisabled || registerAndCaptchaDisabled) {
        return next()
      }
      const response = req.body['g-recaptcha-response']
      const options = {
        form: {
          secret: Settings.recaptcha.secretKey,
          response
        },
        json: true
      }
      return request.post(
        'https://www.google.com/recaptcha/api/siteverify',
        options,
        function(error, response, body) {
          if (error != null) {
            return next(error)
          }
          if (!(body != null ? body.success : undefined)) {
            logger.warn(
              { statusCode: response.statusCode, body },
              'failed recaptcha siteverify request'
            )
            return res.status(400).send({
              errorReason: 'cannot_verify_user_not_robot',
              message: {
                text:
                  'Sorry, we could not verify that you are not a robot. Please check that Google reCAPTCHA is not being blocked by an ad blocker or firewall.'
              }
            })
          } else {
            return next()
          }
        }
      )
    }
  }
}
