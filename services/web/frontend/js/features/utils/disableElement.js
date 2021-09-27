export function disableElement(el) {
  el.setAttribute('disabled', '')
  el.setAttribute('aria-disabled', 'true')
}

export function enableElement(el) {
  el.removeAttribute('disabled')
  el.removeAttribute('aria-disabled')
}
