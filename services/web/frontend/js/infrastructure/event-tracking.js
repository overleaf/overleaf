import sessionStorage from '../infrastructure/session-storage'
import getMeta from '@/utils/meta'

const CACHE_KEY = 'mbEvents'

function alreadySent(key) {
  const eventCache = sessionStorage.getItem(CACHE_KEY) || {}
  return !!eventCache[key]
}
function markAsSent(key) {
  const eventCache = sessionStorage.getItem(CACHE_KEY) || {}
  eventCache[key] = true
  sessionStorage.setItem(CACHE_KEY, eventCache)
}

export function send(category, action, label, value) {
  if (typeof window.ga === 'function') {
    window.ga('send', 'event', category, action, label, value)
  }
}

export function sendOnce(category, action, label, value) {
  if (alreadySent(category)) return
  if (typeof window.ga !== 'function') return

  window.ga('send', 'event', category, action, label, value)
  markAsSent(category)
}

export function sendMB(key, segmentation = {}) {
  if (!segmentation.page) {
    segmentation.page = window.location.pathname
  }

  sendBeacon(key, segmentation)

  if (typeof window.gtag !== 'function') return
  if (['paywall-click', 'paywall-prompt', 'plans-page-click'].includes(key)) {
    window.gtag('event', key, segmentation)
  }
}

export function sendMBOnce(key, segmentation = {}) {
  if (alreadySent(key)) return
  sendMB(key, segmentation)
  markAsSent(key)
}

export function sendMBSampled(key, body = {}, rate = 0.01) {
  if (Math.random() < rate) {
    sendMB(key, body)
  }
}

const sentOncePerPageLoad = new Set()

export function sendMBOncePerPageLoad(key, segmentation = {}) {
  if (sentOncePerPageLoad.has(key)) return
  sendMB(key, segmentation)
  sentOncePerPageLoad.add(key)
}

// Use breakpoint @screen-xs-max from less:
// @screen-xs-max: (@screen-sm-min - 1);
// @screen-sm-min: @screen-sm;
// @screen-sm: 768px;
export const isSmallDevice = window.screen.width < 768

function sendBeacon(key, data) {
  if (!navigator || !navigator.sendBeacon) return
  if (!getMeta('ol-ExposedSettings').isOverleaf) return

  data._csrf = getMeta('ol-csrfToken')
  const blob = new Blob([JSON.stringify(data)], {
    type: 'application/json; charset=UTF-8',
  })
  try {
    navigator.sendBeacon(`/event/${key}`, blob)
  } catch (error) {
    // Ignored. There's a range of browser for which `navigator.sendBeacon` is available but
    // will throw an error if it's called with an unacceptable mime-typed Blob as the data.
  }
}
