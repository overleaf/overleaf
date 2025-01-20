export interface SocketState {
  connected: boolean
  connecting: boolean
  lastError: string
}

export interface DebugInfo {
  sent: number
  received: number
  latency: number | null
  maxLatency: number | null
  clockDelta: number | null
  onLine: boolean | null
  client: Client | null
  unansweredSince: number | null
  lastReceived: number | null
}

interface Client {
  id: string
  publicId: string
  remoteIp: string
  userAgent: string
  connected: boolean
  readable: boolean
  ackPackets: number
  connectedAt: number
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'
