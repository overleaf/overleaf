import { postJSON } from './fetch-json'
import sessionStorage from '../infrastructure/session-storage'

const CACHE_KEY = 'mbEvents'

export function send(category, action, label, value) {
  if (typeof window.ga === 'function') {
    window.ga('send', 'event', category, action, label, value)
  }
}

export function sendMB(key, segmentation = {}) {
  postJSON(`/event/${key}`, { body: segmentation, keepalive: true }).catch(
    () => {
      // ignore errors
    }
  )
}

export function sendMBOnce(key, segmentation = {}) {
  let eventCache = sessionStorage.getItem(CACHE_KEY)

  // Initialize as an empy object if the event cache is still empty.
  if (eventCache == null) {
    eventCache = {}
    sessionStorage.setItem(CACHE_KEY, eventCache)
  }

  const isEventInCache = eventCache[key] || false
  if (!isEventInCache) {
    eventCache[key] = true
    sessionStorage.setItem(CACHE_KEY, eventCache)
    sendMB(key, segmentation)
  }
}

export function sendMBSampled(key, body = {}, rate = 0.01) {
  if (Math.random() < rate) {
    sendMB(key, body)
  }
}
