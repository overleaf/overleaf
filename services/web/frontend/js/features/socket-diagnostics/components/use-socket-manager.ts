import { useState, useEffect, useCallback } from 'react'
import SocketIoShim from '@/ide/connection/SocketIoShim'
import type { Socket } from '@/features/ide-react/connection/types/socket'
import type { DebugInfo, SocketState } from './types'

export function useSocketManager() {
  const [socket, setSocket] = useState<Socket | null>(null)

  const [socketState, setSocketState] = useState<SocketState>({
    connected: false,
    connecting: false,
    lastError: '',
  })

  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    sent: 0,
    received: 0,
    latency: null,
    maxLatency: null,
    onLine: null,
    clockDelta: null,
    client: null,
    lastReceived: null,
  })

  const connectSocket = useCallback(() => {
    const parsedURL = new URL('/socket.io', window.origin)

    setSocketState(prev => ({
      ...prev,
      connecting: true,
      lastAttempt: Date.now(),
    }))

    const newSocket = SocketIoShim.connect(parsedURL.origin, {
      resource: parsedURL.pathname.slice(1),
      'auto connect': false,
      'connect timeout': 30 * 1000,
      'force new connection': true,
      query: new URLSearchParams({ debugging: 'true' }).toString(),
      reconnect: false,
    }) as unknown as Socket

    setSocket(newSocket)
    return newSocket
  }, [])

  const disconnectSocket = useCallback(() => {
    socket?.disconnect()
    setSocket(null)
    setSocketState(prev => ({
      ...prev,
      connected: false,
      connecting: false,
      lastError: 'Manually disconnected',
    }))
  }, [socket])

  const forceReconnect = useCallback(() => {
    disconnectSocket()
    setTimeout(connectSocket, 1000)
  }, [disconnectSocket, connectSocket])

  useEffect(() => {
    connectSocket()
  }, [connectSocket])

  useEffect(() => {
    if (!socket) return

    const statsInterval = setInterval(() => {
      if (socket.socket.connected) {
        setDebugInfo(prev => ({ ...prev, sent: prev.sent + 1 }))
        socket.emit('debug', { time: Date.now() }, (info: any) => {
          const beforeTime = info.data.time
          const now = Date.now()
          const latency = now - beforeTime
          const clockDelta = (beforeTime + beforeTime) / 2 - info.serverTime
          setDebugInfo(prev => ({
            ...prev,
            received: prev.received + 1,
            latency,
            maxLatency: Math.max(prev.maxLatency ?? 0, latency),
            clockDelta,
            client: info.client,
            lastReceived: now,
          }))
        })
      }
    }, 2000)

    socket.on('connect', () => {
      setSocketState(prev => ({
        ...prev,
        connected: true,
        connecting: false,
        lastSuccess: Date.now(),
        lastError: '',
      }))
    })

    socket.on('disconnect', (reason: string) => {
      setSocketState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        lastError: `Disconnected: ${reason}`,
      }))
    })

    socket.on('connect_error', (error: Error) => {
      setSocketState(prev => ({
        ...prev,
        connecting: false,
        lastError: `Connection error: ${error?.message || 'Unknown'}`,
      }))
    })

    socket.socket.connect()

    return () => {
      clearInterval(statsInterval)
      socket.disconnect()
    }
  }, [socket])

  useEffect(() => {
    const updateNetworkInfo = () => {
      if ('connection' in navigator) {
        setDebugInfo(prev => ({ ...prev, onLine: navigator.onLine }))
      }
    }

    window.addEventListener('online', updateNetworkInfo)
    window.addEventListener('offline', updateNetworkInfo)
    updateNetworkInfo()

    return () => {
      window.removeEventListener('online', updateNetworkInfo)
      window.removeEventListener('offline', updateNetworkInfo)
    }
  }, [])

  return {
    socketState,
    debugInfo,
    connectSocket,
    disconnectSocket,
    forceReconnect,
    socket,
  }
}
