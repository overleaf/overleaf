import { inflightHelper } from '../form-helpers/hydrate-form'
import { disableElement } from '../utils/disableElement'

function setup(el: Element) {
  // Make the element discoverable for multi-submit.
  el.setAttribute('data-ol-disabled-inflight', '')

  inflightHelper(el as HTMLElement)
  el.addEventListener('click', function () {
    disableElement(el)
    el.dispatchEvent(new Event('pending'))
  })
}

document.querySelectorAll('[data-ol-slow-link]').forEach(setup)
