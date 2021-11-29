import sessionStorage from '../infrastructure/session-storage'

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
  sendBeacon(key, segmentation)
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

function sendBeacon(key, data) {
  if (!navigator || !navigator.sendBeacon) return

  data._csrf = window.csrfToken
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
