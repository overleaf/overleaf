export default function inputValidator(options) {
  const { selector } = options

  const inputEl = document.querySelector(selector)

  inputEl.addEventListener('input', markDirty)
  inputEl.addEventListener('change', markDirty)
  inputEl.addEventListener('blur', insertInvalidMessage)

  // Mark an input as "dirty": the user has typed something in at some point
  function markDirty() {
    // Note: this is used for the input styling as well as checks when inserting invalid
    // message below
    inputEl.dataset.olDirty = true
  }

  function insertInvalidMessage() {
    if (!inputEl.validity.valid) {
      // Already have a invalid message, don't insert another
      if (inputEl._invalid_message_el) return

      // Only show the message if the input is "dirty"
      if (!inputEl.dataset.olDirty) return

      const messageEl = createMessageEl({
        message: getMessage(inputEl),
        ...options,
      })
      inputEl.insertAdjacentElement('afterend', messageEl)

      // Add a reference so we can remove the element when the input becomes valid
      inputEl._invalid_message_el = messageEl
    } else {
      if (!inputEl._invalid_message_el) return

      // Remove the message element
      inputEl._invalid_message_el.remove()
      // Clean up the reference
      delete inputEl._invalid_message_el
    }
  }

  function cleanUp() {
    inputEl.removeEventListener('input change', markDirty)
    inputEl.removeEventListener('blue', insertInvalidMessage)
    delete inputEl._invalid_message_el
    delete inputEl.dataset.olDirty
  }

  return cleanUp
}

function createMessageEl({ message, messageClasses = [] }) {
  const el = document.createElement('span')
  // From what I understand, using textContent means that we're safe from XSS
  el.textContent = message
  el.classList.add(...messageClasses)

  return el
}

function getMessage(el) {
  // Could be extended to all ValidityState properties: https://developer.mozilla.org/en-US/docs/Web/API/ValidityState
  const { valueMissing, typeMismatch } = el.validity
  if (valueMissing) {
    return el.dataset.olInvalidValueMissing || 'Missing required value'
  } else if (typeMismatch) {
    return el.dataset.olInvalidTypeMismatch || 'Invalid type' // FIXME: Bad default
  } else {
    return 'Invalid'
  }
}
