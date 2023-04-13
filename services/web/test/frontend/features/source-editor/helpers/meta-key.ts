const isMac = /Mac/.test(window.navigator?.platform)

export const metaKey = isMac ? 'meta' : 'ctrl'
