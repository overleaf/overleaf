import { setupSearch } from './search'

document
  .querySelectorAll('[data-ol-contact-form-with-search]')
  .forEach(setupSearch)

document
  .querySelectorAll('[data-ol-open-contact-form-modal="contact-us"]')
  .forEach(el => {
    el.addEventListener('click', function (e) {
      e.preventDefault()
      $('[data-ol-contact-form-modal="contact-us"]').modal()
    })
  })

document
  .querySelectorAll('[data-ol-open-contact-form-modal="general"]')
  .forEach(el => {
    el.addEventListener('click', function (e) {
      e.preventDefault()
      $('[data-ol-contact-form-modal="general"]').modal()
    })
  })

document.querySelectorAll('[data-ol-contact-form]').forEach(el => {
  el.addEventListener('submit', function (e) {
    const emailValue = document.querySelector(
      '[data-ol-contact-form-email-input]'
    ).value
    const thankYouEmailEl = document.querySelector(
      '[data-ol-contact-form-thank-you-email]'
    )
    thankYouEmailEl.textContent = emailValue
  })
})
