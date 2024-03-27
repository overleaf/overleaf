const visibilityOnQuery = '[data-ol-password-visibility-toggle="visibilityOn"]'
const visibilityOffQuery =
  '[data-ol-password-visibility-toggle="visibilityOff"]'

const visibilityOnButton = document.querySelector(visibilityOnQuery)
const visibilityOffButton = document.querySelector(visibilityOffQuery)

if (visibilityOffButton && visibilityOnButton) {
  visibilityOnButton.addEventListener('click', function () {
    const passwordInput = document.querySelector(
      '[data-ol-password-visibility-target]'
    )
    passwordInput.type = 'text'
    visibilityOnButton.hidden = true
    visibilityOffButton.hidden = false
    visibilityOffButton.focus()
  })

  visibilityOffButton.addEventListener('click', function () {
    const passwordInput = document.querySelector(
      '[data-ol-password-visibility-target]'
    )
    passwordInput.type = 'password'
    visibilityOffButton.hidden = true
    visibilityOnButton.hidden = false
    visibilityOnButton.focus()
  })
}
