import { postJSON } from '../../infrastructure/fetch-json'

const grecaptcha = window.grecaptcha

let recaptchaId
const recaptchaCallbacks = []

export async function canSkipCaptcha(email) {
  const controller = new AbortController()
  const signal = controller.signal
  const timer = setTimeout(() => {
    controller.abort()
  }, 1000)
  let canSkip
  try {
    canSkip = await postJSON('/login/can-skip-captcha', {
      signal,
      body: { email },
      swallowAbortError: false,
    })
  } catch (e) {
    canSkip = false
  } finally {
    clearTimeout(timer)
  }
  return canSkip
}

export async function validateCaptchaV2() {
  if (
    // Detect blocked recaptcha
    typeof grecaptcha === 'undefined' ||
    // Detect stubbed recaptcha
    typeof grecaptcha.render !== 'function' ||
    typeof grecaptcha.execute !== 'function' ||
    typeof grecaptcha.reset !== 'function'
  ) {
    return
  }
  if (recaptchaId === undefined) {
    const el = document.getElementById('recaptcha')
    recaptchaId = grecaptcha.render(el, {
      callback: token => {
        recaptchaCallbacks.splice(0).forEach(cb => cb(token))
        grecaptcha.reset(recaptchaId)
      },
    })
  }
  return await new Promise(resolve => {
    recaptchaCallbacks.push(resolve)
    grecaptcha.execute(recaptchaId)
  })
}
