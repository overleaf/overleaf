/* eslint-disable
    max-len,
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], App =>
  App.factory('validateCaptcha', function() {
    let _recaptchaCallbacks = []
    const onRecaptchaSubmit = function(token) {
      for (let cb of Array.from(_recaptchaCallbacks)) {
        cb(token)
      }
      return (_recaptchaCallbacks = [])
    }

    let recaptchaId = null
    const validateCaptcha = callback => {
      if (callback == null) {
        callback = function(response) {}
      }
      if (typeof grecaptcha === 'undefined' || grecaptcha === null) {
        return callback()
      }
      const reset = () => grecaptcha.reset()
      _recaptchaCallbacks.push(callback)
      _recaptchaCallbacks.push(reset)
      if (recaptchaId == null) {
        const el = $('#recaptcha')[0]
        recaptchaId = grecaptcha.render(el, { callback: onRecaptchaSubmit })
      }
      return grecaptcha.execute(recaptchaId)
    }

    return validateCaptcha
  }))
