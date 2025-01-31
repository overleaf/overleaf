import {
  createContext,
  useContext,
  useEffect,
  useState,
  FC,
  useCallback,
  useMemo,
} from 'react'
import {
  ConnectionError,
  ConnectionState,
  SocketDebuggingInfo,
} from '../connection/types/connection-state'
import {
  ConnectionManager,
  StateChangeEvent,
} from '@/features/ide-react/connection/connection-manager'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { secondsUntil } from '@/features/ide-react/connection/utils'
import { useLocation } from '@/shared/hooks/use-location'

type ConnectionContextValue = {
  socket: Socket
  connectionState: ConnectionState
  isConnected: boolean
  isStillReconnecting: boolean
  secondsUntilReconnect: () => number
  tryReconnectNow: () => void
  registerUserActivity: () => void
  closeConnection: (err: ConnectionError) => void
  getSocketDebuggingInfo: () => SocketDebuggingInfo
}

export const ConnectionContext = createContext<
  ConnectionContextValue | undefined
>(undefined)

export const ConnectionProvider: FC = ({ children }) => {
  const location = useLocation()

  const [connectionManager] = useState(() => new ConnectionManager())
  const [connectionState, setConnectionState] = useState(
    connectionManager.state
  )

  useEffect(() => {
    const handleStateChange = ((event: StateChangeEvent) => {
      setConnectionState(event.detail.state)
    }) as EventListener
    connectionManager.addEventListener('statechange', handleStateChange)

    return () => {
      connectionManager.removeEventListener('statechange', handleStateChange)
    }
  }, [connectionManager])

  const isConnected = connectionState.readyState === WebSocket.OPEN

  const isStillReconnecting =
    connectionState.readyState === WebSocket.CONNECTING &&
    performance.now() - connectionState.lastConnectionAttempt > 1000

  const secondsUntilReconnect = useCallback(
    () => secondsUntil(connectionState.reconnectAt),
    [connectionState.reconnectAt]
  )

  const tryReconnectNow = useCallback(
    () => connectionManager.tryReconnectNow(),
    [connectionManager]
  )

  const registerUserActivity = useCallback(
    () => connectionManager.registerUserActivity(),
    [connectionManager]
  )

  const closeConnection = useCallback(
    (err: ConnectionError) => connectionManager.close(err),
    [connectionManager]
  )

  const getSocketDebuggingInfo = useCallback(
    () => connectionManager.getSocketDebuggingInfo(),
    [connectionManager]
  )

  // Reload the page on force disconnect. Doing this in React-land means that we
  // can use useLocation(), which provides mockable location methods
  useEffect(() => {
    if (
      connectionState.forceDisconnected &&
      // keep editor open when out of sync
      connectionState.error !== 'out-of-sync'
    ) {
      const timer = window.setTimeout(
        () => location.reload(),
        connectionState.forcedDisconnectDelay * 1000
      )
      return () => {
        window.clearTimeout(timer)
      }
    }
  }, [
    connectionState.forceDisconnected,
    connectionState.forcedDisconnectDelay,
    connectionState.error,
    location,
  ])

  const value = useMemo<ConnectionContextValue>(
    () => ({
      socket: connectionManager.socket,
      connectionState,
      isConnected,
      isStillReconnecting,
      secondsUntilReconnect,
      tryReconnectNow,
      registerUserActivity,
      closeConnection,
      getSocketDebuggingInfo,
    }),
    [
      connectionManager.socket,
      connectionState,
      isConnected,
      isStillReconnecting,
      registerUserActivity,
      secondsUntilReconnect,
      tryReconnectNow,
      closeConnection,
      getSocketDebuggingInfo,
    ]
  )

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  )
}

export function useConnectionContext(): ConnectionContextValue {
  const context = useContext(ConnectionContext)

  if (!context) {
    throw new Error(
      'useConnectionContext is only available inside ConnectionProvider'
    )
  }

  return context
}
