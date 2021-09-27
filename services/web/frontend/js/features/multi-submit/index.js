import { disableElement } from '../utils/disableElement'

document.querySelectorAll('[data-ol-multi-submit]').forEach(el => {
  function onSubmit() {
    el.querySelectorAll('[data-ol-disabled-inflight]').forEach(disableElement)
  }
  function setup(childEl) {
    childEl.addEventListener('pending', onSubmit)
  }
  el.querySelectorAll('[data-ol-regular-form]').forEach(setup)
  el.querySelectorAll('[data-ol-slow-link]').forEach(setup)
  // NOTE: data-ol-async-form is not added explicitly as of now.
  // Managing the return to idle is tricky and we can look into that later.
})
