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
      if (data.redir || data.redirect) {
        window.location = data.redir || data.redirect
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
        hints: error.data?.message?.hints,
      })

      // Let the user re-submit the form.
      formEl.dispatchEvent(new Event('idle'))
    } finally {
      // call old and new notification builder functions
      // but only one will be rendered
      showMessages(formEl, messageBag)
      showMessagesNewStyle(formEl, messageBag)
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
  const body = Object.fromEntries(
    Array.from(formData.keys(), key => {
      // forms may have multiple keys with the same name, eg: checkboxes
      const val = formData.getAll(key)
      return [key, val.length > 1 ? val : val.pop()]
    })
  )
  const url = formEl.getAttribute('action')
  return postJSON(url, { body })
}

function hideFormElements(formEl) {
  for (const e of formEl.elements) {
    e.hidden = true
  }
}

// TODO: remove the showMessages function after every form alerts are updated to use the new style
// TODO: rename showMessagesNewStyle to showMessages after the above is done
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
    const customErrorElements = message.key
      ? formEl.querySelectorAll(
          `[data-ol-custom-form-message="${message.key}"]`
        )
      : []
    if (message.key && customErrorElements.length > 0) {
      // Found at least one custom error element for key, show them
      customErrorElements.forEach(el => {
        el.hidden = false
      })
    } else {
      // No custom error element for key on page, append a new error message
      const messageEl = document.createElement('div')
      messageEl.className = classNames('alert mb-2', {
        'alert-danger': message.type === 'error',
        'alert-success': message.type !== 'error',
      })
      messageEl.textContent = message.text || `Error: ${message.key}`
      messageEl.setAttribute('aria-live', 'assertive')
      messageEl.setAttribute(
        'role',
        message.type === 'error' ? 'alert' : 'status'
      )
      if (message.hints && message.hints.length) {
        const listEl = document.createElement('ul')
        message.hints.forEach(hint => {
          const listItemEl = document.createElement('li')
          listItemEl.textContent = hint
          listEl.append(listItemEl)
        })
        messageEl.append(listEl)
      }
      messagesEl.append(messageEl)
    }
    if (message.key) {
      // Hide the form elements on specific message types
      const hideOnError = formEl.attributes['data-ol-hide-on-error']
      if (
        hideOnError &&
        hideOnError.value &&
        hideOnError.value.match(message.key)
      ) {
        hideFormElements(formEl)
      }
      // Hide any elements with specific `data-ol-hide-on-error-message` message
      document
        .querySelectorAll(`[data-ol-hide-on-error-message="${message.key}"]`)
        .forEach(el => {
          el.hidden = true
        })
    }
  })
}

function showMessagesNewStyle(formEl, messageBag) {
  const messagesEl = formEl.querySelector('[data-ol-form-messages-new-style]')
  if (!messagesEl) return

  // Clear content
  messagesEl.textContent = ''
  formEl.querySelectorAll('[data-ol-custom-form-message]').forEach(el => {
    el.hidden = true
  })

  // Render messages
  messageBag.forEach(message => {
    const customErrorElements = message.key
      ? formEl.querySelectorAll(
          `[data-ol-custom-form-message="${message.key}"]`
        )
      : []
    if (message.key && customErrorElements.length > 0) {
      // Found at least one custom error element for key, show them
      customErrorElements.forEach(el => {
        el.hidden = false
      })
    } else {
      // No custom error element for key on page, append a new error message
      const messageElContainer = document.createElement('div')
      messageElContainer.className = classNames('notification', {
        'notification-type-error': message.type === 'error',
        'notification-type-success': message.type !== 'error',
      })
      const messageEl = document.createElement('div')

      // create the message text
      messageEl.className = 'notification-content text-left'
      messageEl.textContent = message.text || `Error: ${message.key}`
      messageEl.setAttribute('aria-live', 'assertive')
      messageEl.setAttribute(
        'role',
        message.type === 'error' ? 'alert' : 'status'
      )
      if (message.hints && message.hints.length) {
        const listEl = document.createElement('ul')
        message.hints.forEach(hint => {
          const listItemEl = document.createElement('li')
          listItemEl.textContent = hint
          listEl.append(listItemEl)
        })
        messageEl.append(listEl)
      }

      // create the left icon
      const icon = document.createElement('span')
      icon.className = 'material-symbols'
      icon.setAttribute('aria-hidden', 'true')
      icon.innerText = message.type === 'error' ? 'error' : 'check_circle'
      const messageIcon = document.createElement('div')
      messageIcon.className = 'notification-icon'
      messageIcon.appendChild(icon)

      // append icon first so it's on the left
      messageElContainer.appendChild(messageIcon)
      messageElContainer.appendChild(messageEl)
      messagesEl.append(messageElContainer)
    }
    if (message.key) {
      // Hide the form elements on specific message types
      const hideOnError = formEl.attributes['data-ol-hide-on-error']
      if (
        hideOnError &&
        hideOnError.value &&
        hideOnError.value.match(message.key)
      ) {
        hideFormElements(formEl)
      }
      // Hide any elements with specific `data-ol-hide-on-error-message` message
      document
        .querySelectorAll(`[data-ol-hide-on-error-message="${message.key}"]`)
        .forEach(el => {
          el.hidden = true
        })
    }
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
