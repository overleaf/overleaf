// window location-related functions in a separate module so they can be mocked/stubbed in tests

export function reload() {
  window.location.reload()
}

export function assign(url) {
  window.location.assign(url)
}
