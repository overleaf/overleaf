// window location-related functions in a separate module so they can be mocked/stubbed in tests

export const location = {
  assign(url) {
    // eslint-disable-next-line no-restricted-syntax
    window.location.assign(url)
  },
  reload() {
    // eslint-disable-next-line no-restricted-syntax
    window.location.reload()
  },
}
