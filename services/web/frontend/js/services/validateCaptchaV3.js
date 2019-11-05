define(['base'], function(App) {
  return App.factory('validateCaptchaV3', function() {
    const grecaptcha = window.grecaptcha
    const ExposedSettings = window.ExposedSettings
    return function validateCaptchaV3(actionName, callback = () => {}) {
      if (!grecaptcha) {
        return
      }
      if (!ExposedSettings || !ExposedSettings.recaptchaSiteKeyV3) {
        return
      }
      grecaptcha.ready(function() {
        grecaptcha
          .execute(ExposedSettings.recaptchaSiteKeyV3, { action: actionName })
          .then(callback)
      })
    }
  })
})
