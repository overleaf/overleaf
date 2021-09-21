import { inflightHelper } from '../form-helpers/hydrate-form'

function setup(el) {
  inflightHelper(el)
  el.addEventListener('click', function () {
    el.dispatchEvent(new Event('pending'))
  })
}

document.querySelectorAll('[data-ol-slow-link]').forEach(setup)
