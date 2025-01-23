// window location-related functions in a separate module so they can be mocked/stubbed in tests

export const location = {
  get href() {
    // eslint-disable-next-line no-restricted-syntax
    return window.location.href
  },
  assign(url) {
    // eslint-disable-next-line no-restricted-syntax
    window.location.assign(url)
  },
  replace(url) {
    // eslint-disable-next-line no-restricted-syntax
    window.location.replace(url)
  },
  reload() {
    // eslint-disable-next-line no-restricted-syntax
    window.location.reload()
  },
  setHash(hash) {
    window.location.hash = hash
  },
  toString() {
    // eslint-disable-next-line no-restricted-syntax
    return window.location.toString()
  },
}
