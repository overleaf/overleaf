import classNames from 'classnames'
import { FetchError, postJSON } from '../../infrastructure/fetch-json'
import { canSkipCaptcha, validateCaptchaV2 } from './captcha'
import inputValidator from './input-validator'
import { disableElement, enableElement } from '../utils/disableElement'

// Form helper(s) to handle:
// - Attaching to the relevant form elements
// - Listening for submit event
// - Validating captcha
// - Sending fetch request
// - Redirect handling
// - Showing errors
// - Disabled state

function formSubmitHelper(formEl) {
  formEl.addEventListener('submit', async e => {
    e.preventDefault()

    formEl.dispatchEvent(new Event('pending'))

    const messageBag = []

    try {
      let data
      try {
        const captchaResponse = await validateCaptcha(formEl)
        data = await sendFormRequest(formEl, captchaResponse)
      } catch (e) {
        if (
          e instanceof FetchError &&
          e.data?.errorReason === 'cannot_verify_user_not_robot'
        ) {
          // Trigger captcha unconditionally.
          const captchaResponse = await validateCaptchaV2()
          if (!captchaResponse) {
            throw e
          }
          data = await sendFormRequest(formEl, captchaResponse)
        } else {
          throw e
        }
      }
      formEl.dispatchEvent(new Event('sent'))

      // Handle redirects
      if (data.redir) {
        window.location = data.redir
        return
      }

      // Show a success message (e.g. used on 2FA page)
      if (data.message) {
        messageBag.push({
          type: 'message',
          text: data.message.text || data.message,
        })
      }

      // Handle reloads
      if (formEl.hasAttribute('data-ol-reload-on-success')) {
        window.setTimeout(window.location.reload.bind(window.location), 1000)
        return
      }

      // Let the user re-submit the form.
      formEl.dispatchEvent(new Event('idle'))
    } catch (error) {
      let text = error.message
      if (error instanceof FetchError) {
        text = error.getUserFacingMessage()
      }
      messageBag.push({
        type: 'error',
        key: error.data?.message?.key,
        text,
      })

      // Let the user re-submit the form.
      formEl.dispatchEvent(new Event('idle'))
    } finally {
      showMessages(formEl, messageBag)
    }
  })
}

async function validateCaptcha(formEl) {
  let captchaResponse
  if (formEl.hasAttribute('captcha')) {
    if (
      formEl.getAttribute('action') === '/login' &&
      (await canSkipCaptcha(new FormData(formEl).get('email')))
    ) {
      // The email is present in the deviceHistory, and we can skip the display
      //  of a captcha challenge.
      // The actual login POST request will be checked against the deviceHistory
      //  again and the server can trigger the display of a captcha if needed by
      //  sending a 400 with errorReason set to 'cannot_verify_user_not_robot'.
      return ''
    }
    captchaResponse = await validateCaptchaV2()
  }
  return captchaResponse
}

async function sendFormRequest(formEl, captchaResponse) {
  const formData = new FormData(formEl)
  if (captchaResponse) {
    formData.set('g-recaptcha-response', captchaResponse)
  }
  const body = Object.fromEntries(formData.entries())
  const url = formEl.getAttribute('action')
  return postJSON(url, { body })
}

function showMessages(formEl, messageBag) {
  const messagesEl = formEl.querySelector('[data-ol-form-messages]')
  if (!messagesEl) return

  // Clear content
  messagesEl.textContent = ''
  formEl.querySelectorAll('[data-ol-custom-form-message]').forEach(el => {
    el.hidden = true
  })

  // Render messages
  messageBag.forEach(message => {
    if (message.key) {
      formEl
        .querySelectorAll(`[data-ol-custom-form-message="${message.key}"]`)
        .forEach(el => {
          el.hidden = false
        })
      return
    }

    const messageEl = document.createElement('div')
    messageEl.className = classNames('alert', {
      'alert-danger': message.type === 'error',
      'alert-success': message.type !== 'error',
    })
    messageEl.textContent = message.text
    messageEl.setAttribute('aria-live', 'assertive')
    messageEl.setAttribute(
      'role',
      message.type === 'error' ? 'alert' : 'status'
    )
    messagesEl.append(messageEl)
  })
}

export function inflightHelper(el) {
  const disabledInflight = el.querySelectorAll('[data-ol-disabled-inflight]')
  const showWhenNotInflight = el.querySelectorAll('[data-ol-inflight="idle"]')
  const showWhenInflight = el.querySelectorAll('[data-ol-inflight="pending"]')

  el.addEventListener('pending', () => {
    disabledInflight.forEach(disableElement)
    toggleDisplay(showWhenNotInflight, showWhenInflight)
  })

  el.addEventListener('idle', () => {
    disabledInflight.forEach(enableElement)
    toggleDisplay(showWhenInflight, showWhenNotInflight)
  })
}

function formSentHelper(el) {
  const showWhenPending = el.querySelectorAll('[data-ol-not-sent]')
  const showWhenDone = el.querySelectorAll('[data-ol-sent]')
  if (showWhenDone.length === 0) return

  el.addEventListener('sent', () => {
    toggleDisplay(showWhenPending, showWhenDone)
  })
}

function formValidationHelper(el) {
  el.querySelectorAll('input').forEach(inputEl => {
    if (
      inputEl.willValidate &&
      !inputEl.hasAttribute('data-ol-no-custom-form-validation-messages')
    ) {
      inputValidator(inputEl)
    }
  })
}

function formAutoSubmitHelper(el) {
  if (el.hasAttribute('data-ol-auto-submit')) {
    setTimeout(() => {
      el.querySelector('[type="submit"]').click()
    }, 0)
  }
}

export function toggleDisplay(hide, show) {
  hide.forEach(el => {
    el.hidden = true
  })
  show.forEach(el => {
    el.hidden = false
  })
}

function hydrateAsyncForm(el) {
  formSubmitHelper(el)
  inflightHelper(el)
  formSentHelper(el)
  formValidationHelper(el)
  formAutoSubmitHelper(el)
}

function hydrateRegularForm(el) {
  inflightHelper(el)
  formValidationHelper(el)

  el.addEventListener('submit', () => {
    el.dispatchEvent(new Event('pending'))
  })

  formAutoSubmitHelper(el)
}

document.querySelectorAll(`[data-ol-async-form]`).forEach(hydrateAsyncForm)

document.querySelectorAll(`[data-ol-regular-form]`).forEach(hydrateRegularForm)
