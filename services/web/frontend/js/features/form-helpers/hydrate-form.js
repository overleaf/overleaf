import classNames from 'classnames'
import { FetchError, postJSON } from '../../infrastructure/fetch-json'
import { validateCaptchaV2 } from './captcha'
import inputValidator from './input-validator'

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

    formEl.dispatchEvent(new Event('inflight'))

    // We currently only have capacity to show 1 error, so this is probably
    // unnecessary but I've used a similar data structure in the past and it was
    // nice to be able to handle multiple (e.g. validation) errors at once
    const messageBag = []

    try {
      const captchaResponse = await validateCaptcha(formEl)

      const data = await sendFormRequest(formEl, captchaResponse)
      formEl.dispatchEvent(new Event('sent'))

      // Handle redirects. From poking around, this still appears to be the
      // "correct" way of handling redirects with fetch
      if (data.redir) {
        window.location = data.redir
        return
      }

      // Show a success message (e.g. used on 2FA page)
      if (data.message) {
        messageBag.push({
          type: 'message',
          text: data.message,
        })
      }
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
    } finally {
      // Possibly this could be wired up through events too?
      showMessages(formEl, messageBag)

      formEl.dispatchEvent(new Event('not-inflight'))
    }
  })
  if (formEl.hasAttribute('data-ol-auto-submit')) {
    setTimeout(() => {
      formEl.querySelector('[type="submit"]').click()
    }, 0)
  }
}

async function validateCaptcha(formEl) {
  let captchaResponse
  if (formEl.hasAttribute('captcha')) {
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
    messagesEl.append(messageEl)
  })
}

function formInflightHelper(el) {
  const disabledEl = el.querySelector('[data-ol-disabled-inflight]')
  const showWhenNotInflightEl = el.querySelector('[data-ol-not-inflight-text]')
  const showWhenInflightEl = el.querySelector('[data-ol-inflight-text]')

  el.addEventListener('inflight', () => {
    disabledEl.disabled = true
    toggleDisplay(showWhenNotInflightEl, showWhenInflightEl)
  })

  el.addEventListener('not-inflight', () => {
    disabledEl.disabled = false
    toggleDisplay(showWhenInflightEl, showWhenNotInflightEl)
  })
}

function formSentHelper(el) {
  const showWhenPending = el.querySelector('[data-ol-not-sent]')
  const showWhenDone = el.querySelector('[data-ol-sent]')
  if (!showWhenDone) return

  el.addEventListener('sent', () => {
    toggleDisplay(showWhenPending, showWhenDone)
  })
}

function toggleDisplay(hideEl, showEl) {
  hideEl.setAttribute('hidden', '')
  showEl.removeAttribute('hidden')
}

export function hydrateForm(el) {
  formSubmitHelper(el)
  formInflightHelper(el)
  formSentHelper(el)

  el.querySelectorAll('input').forEach(inputEl => {
    if (
      inputEl.willValidate &&
      !inputEl.hasAttribute('data-ol-no-custom-form-validation-messages')
    ) {
      inputValidator(inputEl)
    }
  })
}

document.querySelectorAll(`[data-ol-form]`).forEach(form => hydrateForm(form))
