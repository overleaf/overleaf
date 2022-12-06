export default function inputValidator(inputEl) {
  const messageEl = document.createElement('div')
  messageEl.className =
    inputEl.getAttribute('data-ol-validation-message-classes') ||
    'small text-danger mt-2'
  messageEl.hidden = true
  inputEl.insertAdjacentElement('afterend', messageEl)

  // Hide messages until the user leaves the input field or submits the form.
  let canDisplayErrorMessages = false

  // Handle all kinds of inputs.
  inputEl.addEventListener('input', handleUpdate)
  inputEl.addEventListener('change', handleUpdate)

  // The user has left the input field.
  inputEl.addEventListener('blur', displayValidationMessages)

  // The user has submitted the form and the current field has errors.
  inputEl.addEventListener('invalid', e => {
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

    if (inputEl.validity.valid) {
      messageEl.hidden = true

      // Require another blur before displaying errors again.
      canDisplayErrorMessages = false
    } else {
      messageEl.textContent = inputEl.validationMessage
      messageEl.hidden = false
    }
  }
}
