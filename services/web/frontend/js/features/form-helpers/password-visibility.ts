;(function () {
  const visibilityOnQuery =
    '[data-ol-password-visibility-toggle="visibilityOn"]'
  const visibilityOffQuery =
    '[data-ol-password-visibility-toggle="visibilityOff"]'

  const visibilityOnButton =
    document.querySelector<HTMLElement>(visibilityOnQuery)
  const visibilityOffButton =
    document.querySelector<HTMLElement>(visibilityOffQuery)

  if (visibilityOffButton && visibilityOnButton) {
    visibilityOnButton.addEventListener('click', function () {
      const passwordInput = document.querySelector<HTMLInputElement>(
        '[data-ol-password-visibility-target]'
      )
      if (passwordInput) {
        passwordInput.type = 'text'
        visibilityOnButton.hidden = true
        visibilityOffButton.hidden = false
        visibilityOffButton.focus()
      }
    })

    visibilityOffButton.addEventListener('click', function () {
      const passwordInput = document.querySelector<HTMLInputElement>(
        '[data-ol-password-visibility-target]'
      )
      if (passwordInput) {
        passwordInput.type = 'password'
        visibilityOffButton.hidden = true
        visibilityOnButton.hidden = false
        visibilityOnButton.focus()
      }
    })
  }
})()
