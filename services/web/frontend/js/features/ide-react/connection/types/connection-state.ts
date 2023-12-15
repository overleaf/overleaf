export type ConnectionError =
  | 'maintenance'
  | 'not-logged-in'
  | 'out-of-sync'
  | 'project-deleted'
  | 'protocol-changed'
  | 'rate-limited'
  | 'unable-to-connect'
  | 'unable-to-join'
  | 'io-not-loaded'

export type ConnectionState = {
  readyState: WebSocket['CONNECTING'] | WebSocket['OPEN'] | WebSocket['CLOSED']
  forceDisconnected: boolean
  inactiveDisconnect: boolean
  reconnectAt: number | null
  forcedDisconnectDelay: number
  lastConnectionAttempt: number
  error: '' | ConnectionError
}
