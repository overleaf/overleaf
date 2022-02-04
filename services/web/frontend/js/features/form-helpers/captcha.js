import 'abort-controller/polyfill'
import { postJSON } from '../../infrastructure/fetch-json'

const grecaptcha = window.grecaptcha

let recaptchaId
const recaptchaCallbacks = []

export async function canSkipCaptcha(email) {
  let timer
  let canSkip
  try {
    const controller = new AbortController()
    const signal = controller.signal
    timer = setTimeout(() => {
      controller.abort()
    }, 1000)
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
