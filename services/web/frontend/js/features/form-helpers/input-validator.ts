import { materialIcon } from '@/features/utils/material-icon'
import classNames from 'classnames'
import '@phosphor-icons/webcomponents/PhWarningCircle'
import { ciamIcon } from '@/features/utils/ciam-icon'

export default function inputValidator(
  inputEl: HTMLInputElement | HTMLTextAreaElement
) {
  const isDsBranded = inputEl.classList.contains('form-control-ds')
  const messageEl = document.createElement('div')
  messageEl.className =
    inputEl.getAttribute('data-ol-validation-message-classes') ||
    classNames(
      'small text-danger mt-2 form-text',

      { 'form-text-ds': isDsBranded }
    )
  messageEl.hidden = true

  const messageInnerEl = messageEl.appendChild(document.createElement('span'))
  messageInnerEl.className = classNames('form-text-inner', {
    'form-text-inner-ds': isDsBranded,
  })

  const messageTextNode = document.createTextNode('')

  const iconEl = isDsBranded
    ? ciamIcon('error', 'ciam-form-text-icon')
    : materialIcon('error')
  messageInnerEl.append(iconEl)
  messageInnerEl.append(messageTextNode)

  const inputContainerEl =
    inputEl.closest('.form-complex-input-container') || inputEl
  inputContainerEl.insertAdjacentElement('afterend', messageEl)

  // Hide messages until the user leaves the input field or submits the form.
  let canDisplayErrorMessages = false

  // Handle all kinds of inputs.
  inputEl.addEventListener('input', handleUpdate)
  inputEl.addEventListener('change', handleUpdate)

  // The user has left the input field.
  inputEl.addEventListener('blur', displayValidationMessages)

  // The user has submitted the form and the current field has errors.
  inputEl.addEventListener('invalid', (e: Event) => {
    // Block the display of browser error messages.
    e.preventDefault()

    // Force the display of messages.
    inputEl.setAttribute('data-ol-dirty', '')

    displayValidationMessages()
  })

  function handleUpdate() {
    // Mark an input as "dirty": the user has typed something in at some point
    inputEl.setAttribute('data-ol-dirty', '')

    // Provide live updates to content sensitive error message like this:
    // Please include an '@' in the email address. 'foo' is missing an '@'.
    // We should not leave a stale message as the user types.
    updateValidationMessageContent()
  }

  function displayValidationMessages() {
    // Display all the error messages and highlight fields with red border.
    canDisplayErrorMessages = true

    updateValidationMessageContent()
  }

  function updateValidationMessageContent() {
    if (!canDisplayErrorMessages) return
    if (!inputEl.hasAttribute('data-ol-dirty')) return

    inputEl.classList.toggle('is-invalid', !inputEl.validity.valid)

    if (inputEl.validity.valid) {
      messageEl.hidden = true

      // Require another blur before displaying errors again.
      canDisplayErrorMessages = false
    } else {
      messageTextNode.data = inputEl.validationMessage
      messageEl.hidden = false
    }
  }
}
