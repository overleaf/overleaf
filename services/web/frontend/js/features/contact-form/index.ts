import { setupSearch } from './search'

document
  .querySelectorAll('[data-ol-contact-form-with-search]')
  .forEach(setupSearch)

document
  .querySelectorAll('[data-ol-open-contact-form-modal="contact-us"]')
  .forEach(el => {
    el.addEventListener('click', function (e) {
      e.preventDefault()
    })
  })

document
  .querySelectorAll('[data-ol-open-contact-form-modal="general"]')
  .forEach(el => {
    el.addEventListener('click', function (e) {
      e.preventDefault()
    })
  })

document.querySelectorAll('[data-ol-contact-form]').forEach(el => {
  el.addEventListener('submit', function () {
    const emailInput = document.querySelector<HTMLInputElement>(
      '[data-ol-contact-form-email-input]'
    )
    const thankYouEmailEl = document.querySelector<HTMLElement>(
      '[data-ol-contact-form-thank-you-email]'
    )

    if (emailInput && thankYouEmailEl) {
      thankYouEmailEl.textContent = emailInput.value
    }
  })
})
