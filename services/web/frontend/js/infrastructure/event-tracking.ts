import sessionStorage from './session-storage'
import getMeta from '@/utils/meta'

type Segmentation = Record<
  string,
  string | number | boolean | undefined | unknown | any // TODO: RecurlyError
>

const CACHE_KEY = 'mbEvents'

function alreadySent(key: string) {
  const eventCache = sessionStorage.getItem(CACHE_KEY) || {}
  return !!eventCache[key]
}
function markAsSent(key: string) {
  const eventCache = sessionStorage.getItem(CACHE_KEY) || {}
  eventCache[key] = true
  sessionStorage.setItem(CACHE_KEY, eventCache)
}

export function send(
  category: string,
  action: string,
  label?: string,
  value?: string
) {
  if (typeof window.ga === 'function') {
    window.ga('send', 'event', category, action, label, value)
  }
}

export function sendOnce(
  category: string,
  action: string,
  label: string,
  value: string
) {
  if (alreadySent(category)) return
  if (typeof window.ga !== 'function') return

  window.ga('send', 'event', category, action, label, value)
  markAsSent(category)
}

export function sendMB(key: string, segmentation: Segmentation = {}) {
  if (!segmentation.page) {
    segmentation.page = window.location.pathname
  }

  sendBeacon(key, segmentation)

  if (typeof window.gtag !== 'function') return
  if (['paywall-click', 'paywall-prompt', 'plans-page-click'].includes(key)) {
    window.gtag('event', key, segmentation)
  }
}

export function sendMBOnce(key: string, segmentation: Segmentation = {}) {
  if (alreadySent(key)) return
  sendMB(key, segmentation)
  markAsSent(key)
}

export function sendMBSampled(
  key: string,
  segmentation: Segmentation = {},
  rate = 0.01
) {
  if (Math.random() < rate) {
    sendMB(key, segmentation)
  }
}

const sentOncePerPageLoad = new Set()

export function sendMBOncePerPageLoad(
  key: string,
  segmentation: Segmentation = {}
) {
  if (sentOncePerPageLoad.has(key)) return
  sendMB(key, segmentation)
  sentOncePerPageLoad.add(key)
}

// Use breakpoint @screen-xs-max from less:
// @screen-xs-max: (@screen-sm-min - 1);
// @screen-sm-min: @screen-sm;
// @screen-sm: 768px;
export const isSmallDevice = window.screen.width < 768

function sendBeacon(key: string, data: Segmentation) {
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
