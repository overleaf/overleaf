import {
  createContext,
  useContext,
  useEffect,
  useState,
  FC,
  useCallback,
  useMemo,
} from 'react'
import { ConnectionState } from '../connection/types/connection-state'
import { ConnectionManager } from '@/features/ide-react/connection/connection-manager'
import { Socket } from '@/features/ide-react/connection/types/socket'
import { secondsUntil } from '@/features/ide-react/connection/utils'

type ConnectionContextValue = {
  socket: Socket
  connectionState: ConnectionState
  isConnected: boolean
  isStillReconnecting: boolean
  secondsUntilReconnect: () => number
  tryReconnectNow: () => void
  registerUserActivity: () => void
  disconnect: () => void
}

const ConnectionContext = createContext<ConnectionContextValue | undefined>(
  undefined
)

export const ConnectionProvider: FC = ({ children }) => {
  const [connectionManager] = useState(() => new ConnectionManager())
  const [connectionState, setConnectionState] = useState(
    connectionManager.state
  )

  useEffect(() => {
    function handleStateChange(event: { state: ConnectionState }) {
      setConnectionState(event.state)
    }
    connectionManager.on('statechange', handleStateChange)

    return () => {
      connectionManager.off('statechange', handleStateChange)
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

  const disconnect = useCallback(() => {
    connectionManager.disconnect()
  }, [connectionManager])

  const value = useMemo<ConnectionContextValue>(
    () => ({
      socket: connectionManager.socket,
      connectionState,
      isConnected,
      isStillReconnecting,
      secondsUntilReconnect,
      tryReconnectNow,
      registerUserActivity,
      disconnect,
    }),
    [
      connectionManager.socket,
      connectionState,
      isConnected,
      isStillReconnecting,
      registerUserActivity,
      secondsUntilReconnect,
      tryReconnectNow,
      disconnect,
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
