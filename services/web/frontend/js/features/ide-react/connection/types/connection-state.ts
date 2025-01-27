export type ConnectionError =
  | 'io-not-loaded'
  | 'maintenance'
  | 'not-logged-in'
  | 'out-of-sync'
  | 'project-deleted'
  | 'protocol-changed'
  | 'rate-limited'
  | 'unable-to-connect'
  | 'unable-to-join'

export type ConnectionState = {
  readyState: WebSocket['CONNECTING'] | WebSocket['OPEN'] | WebSocket['CLOSED']
  forceDisconnected: boolean
  inactiveDisconnect: boolean
  reconnectAt: number | null
  forcedDisconnectDelay: number
  lastConnectionAttempt: number
  error: '' | ConnectionError
}

export type ExternalHeartbeat = {
  currentStart: number
  lastSuccess: number
  lastLatency: number
}

export type SocketDebuggingInfo = {
  client_id?: string
  publicId?: string
  transport?: string
  lastUserActivity: number
  connectionState: ConnectionState
  externalHeartbeat: ExternalHeartbeat
}
