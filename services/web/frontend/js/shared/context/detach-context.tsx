import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useState,
  FC,
} from 'react'
import getMeta from '../../utils/meta'
import { buildUrlWithDetachRole } from '../utils/url-helper'
import useCallbackHandlers from '../hooks/use-callback-handlers'
import { debugConsole } from '@/utils/debugging'

export type DetachRole = 'detacher' | 'detached' | null

type Message = {
  role: DetachRole
  event: string
  data?: any
}

export const DetachContext = createContext<
  | {
      role: DetachRole
      setRole: (role: DetachRole) => void
      broadcastEvent: (event: string, data?: any) => void
      addEventHandler: (handler: (...args: any[]) => void) => void
      deleteEventHandler: (handler: (...args: any[]) => void) => void
    }
  | undefined
>(undefined)

const debugPdfDetach = getMeta('ol-debugPdfDetach')

const projectId = getMeta('ol-project_id')
export const detachChannelId = `detach-${projectId}`
export const detachChannel =
  'BroadcastChannel' in window
    ? new BroadcastChannel(detachChannelId)
    : undefined

export const DetachProvider: FC<React.PropsWithChildren> = ({ children }) => {
  const [lastDetachedConnectedAt, setLastDetachedConnectedAt] = useState<Date>()
  const [role, setRole] = useState(() => getMeta('ol-detachRole') || null)
  const {
    addHandler: addEventHandler,
    deleteHandler: deleteEventHandler,
    callHandlers: callEventHandlers,
  } = useCallbackHandlers()

  useEffect(() => {
    if (debugPdfDetach) {
      debugConsole.warn('Effect', { role })
    }
    window.history.replaceState({}, '', buildUrlWithDetachRole(role).toString())
  }, [role])

  useEffect(() => {
    if (detachChannel) {
      const listener = (event: MessageEvent) => {
        if (debugPdfDetach) {
          debugConsole.warn(`Receiving:`, event.data)
        }
        callEventHandlers(event.data)
      }

      detachChannel.addEventListener('message', listener)

      return () => {
        detachChannel.removeEventListener('message', listener)
      }
    }
  }, [callEventHandlers])

  const broadcastEvent = useCallback(
    (event: string, data?: any) => {
      if (!role) {
        if (debugPdfDetach) {
          debugConsole.warn('Not Broadcasting (no role)', {
            role,
            event,
            data,
          })
        }
        return
      }
      if (debugPdfDetach) {
        debugConsole.warn('Broadcasting', {
          role,
          event,
          data,
        })
      }
      const message: Message = { role, event }
      if (data) {
        message.data = data
      }

      detachChannel?.postMessage(message)
    },
    [role]
  )

  useEffect(() => {
    broadcastEvent('connected')
  }, [broadcastEvent])

  useEffect(() => {
    const onBeforeUnload = () => broadcastEvent('closed')
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [broadcastEvent])

  useEffect(() => {
    const updateLastDetachedConnectedAt = (message: Message) => {
      if (message.role === 'detached' && message.event === 'connected') {
        setLastDetachedConnectedAt(new Date())
      }
    }
    addEventHandler(updateLastDetachedConnectedAt)
    return () => deleteEventHandler(updateLastDetachedConnectedAt)
  }, [addEventHandler, deleteEventHandler])

  const value = useMemo(
    () => ({
      role,
      setRole,
      broadcastEvent,
      lastDetachedConnectedAt,
      addEventHandler,
      deleteEventHandler,
    }),
    [
      role,
      setRole,
      broadcastEvent,
      lastDetachedConnectedAt,
      addEventHandler,
      deleteEventHandler,
    ]
  )

  return (
    <DetachContext.Provider value={value}>{children}</DetachContext.Provider>
  )
}

export function useDetachContext() {
  const data = useContext(DetachContext)
  if (!data) {
    throw new Error('useDetachContext is only available inside DetachProvider')
  }
  return data
}
