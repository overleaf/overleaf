import 'abort-controller/polyfill'
import { postJSON } from '../../infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { ReCaptchaInstance } from '@ol-types/recaptcha'

interface RecaptchaCallback {
  resolve: (token: string) => void
  reject: (error: Error) => void
  resetTimeout: () => void
}

const grecaptcha: ReCaptchaInstance | undefined = window.grecaptcha

let recaptchaId: string | undefined
let canResetCaptcha: boolean
let isFromReset: boolean
let resetFailed: boolean
const recaptchaCallbacks: RecaptchaCallback[] = []

function resetCaptcha() {
  if (!canResetCaptcha || !grecaptcha || recaptchaId === undefined) return
  canResetCaptcha = false
  isFromReset = true
  grecaptcha.reset(recaptchaId)
}

function handleAbortedCaptcha() {
  if (recaptchaCallbacks.length > 0) {
    // There is a pending captcha process and the user dismissed it by
    //  clicking somewhere else on the page. Show it again.
    // But first clear the timeout to give the user more time to solve the
    //  next one.
    recaptchaCallbacks.forEach(({ resetTimeout }) => resetTimeout())
    validateCaptchaV2().catch(() => {
      // The other callback is still there to pick up the result
    })
  }
}

function emitToken(token: string) {
  recaptchaCallbacks.splice(0).forEach(({ resolve, resetTimeout }) => {
    resetTimeout()
    resolve(token)
  })

  // Happy path, let the user solve another one -- if needed.
  canResetCaptcha = true
  resetCaptcha()
}

function getMessage(err: Error | unknown): string {
  return (err as Error)?.message || 'no details returned'
}

function emitError(err: Error, src: string) {
  if (isFromReset) {
    resetFailed = true
  }

  const error = new Error(
    `captcha check failed: ${getMessage(err)}, please retry again`
  )
  // Keep a record of this error. 2nd line might request a screenshot of it.
  debugConsole.error(error, src)

  recaptchaCallbacks.splice(0).forEach(({ reject, resetTimeout }) => {
    resetTimeout()
    reject(error)
  })

  // Unhappy path: Only reset if not failed before.
  // This could be a loop without human interaction: error -> reset -> error.
  resetCaptcha()
}

export async function canSkipCaptcha(email: string): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let canSkip: boolean
  try {
    const controller = new AbortController()
    const signal = controller.signal
    timer = setTimeout(() => {
      controller.abort()
    }, 1000)
    canSkip = await postJSON<boolean>('/login/can-skip-captcha', {
      signal,
      body: { email },
      swallowAbortError: false,
    })
  } catch (e) {
    canSkip = false
  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
  return canSkip
}

export async function validateCaptchaV2(): Promise<string | undefined> {
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
    if (!el) {
      throw new Error('recaptcha element not found')
    }
    recaptchaId = grecaptcha.render(el, {
      callback: (token: string) => {
        emitToken(token)
      },
      'error-callback': () => {
        emitError(
          new Error('recaptcha: something went wrong'),
          'error-callback'
        )
      },
      'expired-callback': () => {
        emitError(new Error('recaptcha: challenge expired'), 'expired-callback')
      },
    })
    // Attach abort handler once when setting up the captcha.
    const retryArea = document.querySelector(
      '[data-ol-captcha-retry-trigger-area]'
    )
    if (retryArea) {
      retryArea.addEventListener('click', handleAbortedCaptcha)
    }
  }

  if (resetFailed) {
    throw new Error('captcha not available. try reloading the page')
  }

  // This is likely a human making a submit action. Let them retry on error.
  canResetCaptcha = true
  isFromReset = false

  return await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      // We triggered this error. Ensure that we can reset to captcha.
      canResetCaptcha = true

      emitError(new Error('challenge expired'), 'timeout')

      // The iframe title says it will expire after 2 min. Enforce that here.
    }, 120 * 1000)

    recaptchaCallbacks.push({
      resolve,
      reject,
      resetTimeout: () => clearTimeout(timeout),
    })
    try {
      if (grecaptcha && recaptchaId !== undefined) {
        grecaptcha.execute(recaptchaId).catch((err: Error) => {
          emitError(new Error(`recaptcha: ${getMessage(err)}`), '.catch()')
        })
      }
    } catch (err) {
      emitError(new Error(`recaptcha: ${getMessage(err)}`), 'try/catch')
    }

    // Try to (re-)attach a handler to the backdrop element of the popup.
    for (const delay of [1, 10, 100, 1000]) {
      setTimeout(() => {
        const el = document.body.lastChild as HTMLElement
        if (!el || el.tagName !== 'DIV') return
        el.removeEventListener('click', handleAbortedCaptcha)
        el.addEventListener('click', handleAbortedCaptcha)
      }, delay)
    }
  })
}
