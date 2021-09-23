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

    formEl.dispatchEvent(new Event('pending'))

    const messageBag = []

    try {
      const captchaResponse = await validateCaptcha(formEl)

      const data = await sendFormRequest(formEl, captchaResponse)
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
      showMessages(formEl, messageBag)

      formEl.dispatchEvent(new Event('idle'))
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
    disabledInflight.forEach(el => {
      el.disabled = true
    })
    toggleDisplay(showWhenNotInflight, showWhenInflight)
  })

  el.addEventListener('idle', () => {
    disabledInflight.forEach(el => {
      el.disabled = false
    })
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

export function toggleDisplay(hide, show) {
  hide.forEach(el => {
    el.hidden = true
  })
  show.forEach(el => {
    el.hidden = false
  })
}

export function hydrateForm(el) {
  formSubmitHelper(el)
  inflightHelper(el)
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

document
  .querySelectorAll(`[data-ol-async-form]`)
  .forEach(form => hydrateForm(form))
