import { postJSON } from './fetch-json'

export function send(category, action, label, value) {
  if (typeof window.ga === 'function') {
    window.ga('send', 'event', category, action, label, value)
  }
}

export function sendMB(key, body = {}) {
  postJSON(`/event/${key}`, { body }).catch(() => {
    // ignore errors
  })
}
