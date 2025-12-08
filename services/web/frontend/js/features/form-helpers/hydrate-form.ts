import classNames from 'classnames'
import { FetchError, postJSON } from '../../infrastructure/fetch-json'
import { canSkipCaptcha, validateCaptchaV2 } from './captcha'
import inputValidator from './input-validator'
import { disableElement, enableElement } from '../utils/disableElement'
import { materialIcon as createMaterialIcon } from '@/features/utils/material-icon'
import { ciamIcon } from '@/features/utils/ciam-icon'

// Form helper(s) to handle:
// - Attaching to the relevant form elements
// - Listening for submit event
// - Validating captcha
// - Sending fetch request
// - Redirect handling
// - Showing errors
// - Disabled state

interface FormResponse {
  redir?: string
  redirect?: string
  message?:
    | {
        text?: string
      }
    | string
}

interface ErrorWithData {
  data?: {
    message?: {
      key?: string
      hints?: string[]
    }
  }
}

interface MessageBagItem {
  type: 'error' | 'message' | 'success' | 'warning' | 'info'
  key?: string
  text: string
  hints?: string[]
}

function formSubmitHelper(formEl: HTMLFormElement) {
  formEl.addEventListener('submit', async (e: Event) => {
    e.preventDefault()

    formEl.dispatchEvent(new Event('pending'))

    const messageBag: MessageBagItem[] = []

    try {
      let data: FormResponse
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
        window.location.href = data.redir || data.redirect!
        return
      }

      // Show a success message (e.g. used on 2FA page)
      if (data.message) {
        messageBag.push({
          type: 'message',
          text:
            typeof data.message === 'string'
              ? data.message
              : data.message.text || '',
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
      let text = (error as Error).message
      let key: string | undefined
      let hints: string[] | undefined

      if (error instanceof FetchError) {
        text = error.getUserFacingMessage()
      }

      const errorWithData = error as ErrorWithData
      if (errorWithData.data?.message) {
        key = errorWithData.data.message.key
        hints = errorWithData.data.message.hints
      }

      messageBag.push({
        type: 'error',
        key,
        text,
        hints,
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

async function validateCaptcha(
  formEl: HTMLFormElement
): Promise<string | undefined> {
  let captchaResponse: string | undefined
  if (
    formEl.hasAttribute('captcha') &&
    // Disable captcha for E2E tests in dev-env.
    !(process.env.NODE_ENV === 'development' && window.Cypress)
  ) {
    if (
      formEl.getAttribute('action') === '/login' &&
      (await canSkipCaptcha(new FormData(formEl).get('email') as string))
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

async function sendFormRequest(
  formEl: HTMLFormElement,
  captchaResponse?: string
): Promise<FormResponse> {
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
  const url = formEl.getAttribute('action')!
  return postJSON<FormResponse>(url, { body })
}

function hideFormElements(formEl: HTMLFormElement) {
  for (const element of formEl.elements) {
    if (element instanceof HTMLElement) {
      element.hidden = true
    }
  }
}

/**
 * Creates a notification element from a message object.
 */
function createNotificationFromMessage(
  message: MessageBagItem
): HTMLDivElement {
  const messageEl = document.createElement('div')
  messageEl.className = classNames('mb-3 notification', {
    'notification-type-error': message.type === 'error',
    'notification-type-success': message.type === 'success',
    'notification-type-warning': message.type === 'warning',
    'notification-type-info': message.type === 'info',
  })
  messageEl.setAttribute('aria-live', 'assertive')
  messageEl.setAttribute('role', message.type === 'error' ? 'alert' : 'status')

  const materialIconLookup: Record<string, string> = {
    info: 'info',
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
  }
  const materialIcon = materialIconLookup[message.type]

  if (materialIcon) {
    const iconEl = document.createElement('div')
    iconEl.className = 'notification-icon'
    const iconSpan = createMaterialIcon(materialIcon)
    iconEl.append(iconSpan)
    messageEl.append(iconEl)
  }

  const contentAndCtaEl = document.createElement('div')
  contentAndCtaEl.className = 'notification-content-and-cta'

  const contentEl = document.createElement('div')
  contentEl.className = 'notification-content'
  contentEl.append(message.text || `Error: ${message.key}`)

  if (message.hints && message.hints.length) {
    const listEl = document.createElement('ul')
    message.hints.forEach(hint => {
      const listItemEl = document.createElement('li')
      listItemEl.textContent = hint
      listEl.append(listItemEl)
    })
    contentEl.append(listEl)
  }
  contentAndCtaEl.append(contentEl)
  messageEl.append(contentAndCtaEl)

  return messageEl
}

// TODO: remove the showMessages function after every form alerts are updated to use the new style
// TODO: rename showMessagesNewStyle to showMessages after the above is done
function showMessages(formEl: HTMLFormElement, messageBag: MessageBagItem[]) {
  const messagesEl = formEl.querySelector('[data-ol-form-messages]')
  if (!messagesEl) return

  // Clear content
  messagesEl.textContent = ''
  formEl
    .querySelectorAll<HTMLElement>('[data-ol-custom-form-message]')
    .forEach(el => {
      el.hidden = true
    })

  // Render messages
  messageBag.forEach(message => {
    const customErrorElements = message.key
      ? formEl.querySelectorAll<HTMLElement>(
          `[data-ol-custom-form-message="${message.key}"]`
        )
      : []
    if (message.key && customErrorElements.length > 0) {
      // Found at least one custom error element for key, show them
      customErrorElements.forEach(el => {
        el.hidden = false
      })
    } else {
      const notification = createNotificationFromMessage(message)
      messagesEl.append(notification)
    }
    if (message.key) {
      // Hide the form elements on specific message types
      const hideOnError = formEl.attributes.getNamedItem(
        'data-ol-hide-on-error'
      )
      if (
        hideOnError &&
        hideOnError.value &&
        hideOnError.value.match(message.key)
      ) {
        hideFormElements(formEl)
      }
      // Hide any elements with specific `data-ol-hide-on-error-message` message
      document
        .querySelectorAll<HTMLElement>(
          `[data-ol-hide-on-error-message="${message.key}"]`
        )
        .forEach(el => {
          el.hidden = true
        })
    }
  })
}

function showMessagesNewStyle(
  formEl: HTMLFormElement,
  messageBag: MessageBagItem[]
) {
  const messagesEl = formEl.querySelector('[data-ol-form-messages-new-style]')
  if (!messagesEl) return

  // Clear content
  messagesEl.textContent = ''
  formEl
    .querySelectorAll<HTMLElement>('[data-ol-custom-form-message]')
    .forEach(el => {
      el.hidden = true
    })

  const isDsBranded = formEl.dataset.ciamForm !== undefined

  // Render messages
  messageBag.forEach(message => {
    const customErrorElements = message.key
      ? formEl.querySelectorAll<HTMLElement>(
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
        'notification-ds': isDsBranded,
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
      const messageIcon = document.createElement('div')
      messageIcon.className = 'notification-icon'
      if (
        isDsBranded &&
        (message.type === 'error' || message.type === 'info')
      ) {
        messageIcon.append(ciamIcon(message.type))
      } else {
        const icon = createMaterialIcon(
          message.type === 'error' ? 'error' : 'check_circle'
        )
        messageIcon.appendChild(icon)
      }

      // append icon first so it's on the left
      messageElContainer.appendChild(messageIcon)
      messageElContainer.appendChild(messageEl)
      messagesEl.append(messageElContainer)
    }
    if (message.key) {
      // Hide the form elements on specific message types
      const hideOnError = formEl.attributes.getNamedItem(
        'data-ol-hide-on-error'
      )
      if (
        hideOnError &&
        hideOnError.value &&
        hideOnError.value.match(message.key)
      ) {
        hideFormElements(formEl)
      }
      // Hide any elements with specific `data-ol-hide-on-error-message` message
      document
        .querySelectorAll<HTMLElement>(
          `[data-ol-hide-on-error-message="${message.key}"]`
        )
        .forEach(el => {
          el.hidden = true
        })
    }
  })
}

function querySelectorAllWithSelf(el: HTMLElement, selector: string) {
  const nodeList = el.querySelectorAll<HTMLElement>(selector)
  return el.matches(selector) ? [el, ...nodeList] : Array.from(nodeList)
}

export function inflightHelper(el: HTMLElement) {
  const disabledInflight = querySelectorAllWithSelf(
    el,
    '[data-ol-disabled-inflight]'
  )
  const showWhenNotInflight = el.querySelectorAll<HTMLElement>(
    '[data-ol-inflight="idle"]'
  )
  const showWhenInflight = el.querySelectorAll<HTMLElement>(
    '[data-ol-inflight="pending"]'
  )
  const spinnerInflight = querySelectorAllWithSelf(
    el,
    '[data-ol-spinner-inflight]'
  )

  el.addEventListener('pending', () => {
    disabledInflight.forEach(disableElement)
    toggleDisplay(showWhenNotInflight, showWhenInflight)
    spinnerInflight.forEach(loadingEl => {
      loadingEl.setAttribute('data-ol-loading', 'true')
      loadingEl.classList.add('button-loading')
    })
  })

  el.addEventListener('idle', () => {
    disabledInflight.forEach(enableElement)
    toggleDisplay(showWhenInflight, showWhenNotInflight)
    spinnerInflight.forEach(loadingEl => {
      loadingEl.removeAttribute('data-ol-loading')
      loadingEl.classList.remove('button-loading')
    })
  })
}

function formSentHelper(el: HTMLElement) {
  const showWhenPending = el.querySelectorAll<HTMLElement>('[data-ol-not-sent]')
  const showWhenDone = el.querySelectorAll<HTMLElement>('[data-ol-sent]')
  if (showWhenDone.length === 0) return

  el.addEventListener('sent', () => {
    toggleDisplay(showWhenPending, showWhenDone)
  })
}

function formValidationHelper(el: HTMLFormElement) {
  el.querySelectorAll('input, textarea').forEach(inputEl => {
    const element = inputEl as HTMLInputElement | HTMLTextAreaElement
    if (
      element.willValidate &&
      !inputEl.hasAttribute('data-ol-no-custom-form-validation-messages')
    ) {
      inputValidator(element)
    }
  })
}

function formAutoSubmitHelper(el: HTMLFormElement) {
  if (el.hasAttribute('data-ol-auto-submit')) {
    setTimeout(() => {
      const submitButton =
        el.querySelector<HTMLButtonElement>('[type="submit"]')
      submitButton?.click()
    }, 0)
  }
}

export function toggleDisplay(
  hide: NodeListOf<HTMLElement>,
  show: NodeListOf<HTMLElement>
) {
  hide.forEach(el => {
    el.hidden = true
  })
  show.forEach(el => {
    el.hidden = false
  })
}

function hydrateAsyncForm(el: HTMLFormElement) {
  formSubmitHelper(el)
  inflightHelper(el)
  formSentHelper(el)
  formValidationHelper(el)
  formAutoSubmitHelper(el)
}

function hydrateRegularForm(el: HTMLFormElement) {
  inflightHelper(el)
  formValidationHelper(el)

  el.addEventListener('submit', () => {
    el.dispatchEvent(new Event('pending'))
  })

  formAutoSubmitHelper(el)
}

document
  .querySelectorAll<HTMLFormElement>('[data-ol-async-form]')
  .forEach(hydrateAsyncForm)

document
  .querySelectorAll<HTMLFormElement>('[data-ol-regular-form]')
  .forEach(hydrateRegularForm)
