let _recaptchaId: string
let _recaptchaResolve: ((token: string) => void) | undefined

export function executeV2Captcha(disabled: boolean = false) {
  return new Promise<void | string>((resolve, reject) => {
    if (disabled || !window.grecaptcha) {
      return resolve()
    }

    try {
      if (!_recaptchaId) {
        _recaptchaId = window.grecaptcha.render('recaptcha', {
          callback: (token: string) => {
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
