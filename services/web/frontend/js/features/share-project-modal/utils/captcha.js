let _recaptchaId
let _recaptchaResolve
export function executeV2Captcha(disabled = false) {
  return new Promise((resolve, reject) => {
    if (disabled || !window.grecaptcha) {
      return resolve()
    }

    try {
      if (!_recaptchaId) {
        _recaptchaId = window.grecaptcha.render('recaptcha', {
          callback: token => {
            if (_recaptchaResolve) {
              _recaptchaResolve(token)
              _recaptchaResolve = undefined
            }
            window.grecaptcha.reset()
          },
        })
      }
      _recaptchaResolve = resolve
    } catch (error) {
      reject(error)
    }
  })
}
