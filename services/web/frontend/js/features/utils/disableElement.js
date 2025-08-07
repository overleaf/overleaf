export function disableElement(el) {
  if (el.tagName.toLowerCase() === 'a') {
    el.classList.add('disabled')
  } else {
    el.disabled = true
  }
  el.setAttribute('aria-disabled', 'true')
}

export function enableElement(el) {
  if (el.tagName.toLowerCase() === 'a') {
    el.classList.remove('disabled')
  } else {
    el.disabled = false
  }
  el.removeAttribute('aria-disabled')
}
