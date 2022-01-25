import { disableElement, enableElement } from '../utils/disableElement'

document.querySelectorAll('[data-ol-multi-submit]').forEach(el => {
  function setup(childEl) {
    childEl.addEventListener('pending', () => {
      el.querySelectorAll('[data-ol-disabled-inflight]').forEach(disableElement)
    })
    childEl.addEventListener('idle', () => {
      el.querySelectorAll('[data-ol-disabled-inflight]').forEach(enableElement)
    })
  }
  el.querySelectorAll('[data-ol-async-form]').forEach(setup)
  el.querySelectorAll('[data-ol-regular-form]').forEach(setup)
  el.querySelectorAll('[data-ol-slow-link]').forEach(setup)
})
