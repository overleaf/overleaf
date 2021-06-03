import { postJSON } from './fetch-json'

export function send(category, action, label, value) {
  if (typeof window.ga === 'function') {
    window.ga('send', 'event', category, action, label, value)
  }
}

export function sendMB(key, body = {}) {
  postJSON(`/event/${key}`, { body, keepalive: true }).catch(() => {
    // ignore errors
  })
}

export function sendMBSampled(key, body = {}, rate = 0.01) {
  if (Math.random() < rate) {
    sendMB(key, body)
  }
}
