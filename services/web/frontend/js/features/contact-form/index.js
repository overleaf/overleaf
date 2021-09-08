import { setupSearch } from './search'

document
  .querySelectorAll('[data-ol-contact-form-with-search]')
  .forEach(setupSearch)

document.querySelectorAll('a[ng-click="contactUsModal()"]').forEach(el => {
  el.addEventListener('click', function (e) {
    e.preventDefault()
    $('[data-ol-contact-form-modal]').modal()
  })
})
