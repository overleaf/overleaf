import { debugConsole } from '@/utils/debugging'

export const createTrackingLoader = (cb: () => void, name: string) => {
  // avoid inserting twice
  let initialized = false

  const loadTracking = () => {
    // consent needed
    const consent = document.cookie.split('; ').some(item => item === 'oa=1')
    if (initialized || !consent) {
      return
    }
    debugConsole.log('Loading Analytics', name)
    initialized = true
    cb()
  }

  // load when idle, if supported
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(loadTracking)
  } else {
    loadTracking()
  }

  // listen for consent
  window.addEventListener('cookie-consent', event => {
    if ((event as CustomEvent<boolean>).detail) {
      loadTracking()
    }
  })
}

export const insertScript = (attr: {
  src: string
  crossorigin?: string
  async?: boolean
  onload?: () => void
}) => {
  const script = document.createElement('script')
  script.setAttribute('src', attr.src)

  if (attr.crossorigin) {
    script.setAttribute('crossorigin', attr.crossorigin)
  }

  if (attr.async) {
    script.setAttribute('async', 'async')
  }

  if (attr.onload) {
    script.onload = attr.onload
  }

  document.querySelector('head')?.append(script)
}
