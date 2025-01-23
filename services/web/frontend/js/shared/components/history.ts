// window.history-related functions in a separate module so they can be mocked/stubbed in tests

export const history = {
  pushState(data: any, unused: string, url?: string | URL | null) {
    window.history.pushState(data, unused, url)
  },
}
