/* eslint-disable
    no-return-assign,
    no-undef,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 */
define(['base'], App =>
  App.factory('validateCaptcha', function() {
    let _recaptchaCallbacks = []
    const onRecaptchaSubmit = function(token) {
      for (let cb of _recaptchaCallbacks) {
        cb(token)
      }
      _recaptchaCallbacks = []
    }

    let recaptchaId = null
    const validateCaptcha = (callback, captchaDisabled) => {
      if (callback == null) {
        callback = function(response) {}
      }
      if (
        typeof grecaptcha === 'undefined' ||
        grecaptcha === null ||
        captchaDisabled
      ) {
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
