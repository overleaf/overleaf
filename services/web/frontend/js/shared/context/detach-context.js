import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useState,
} from 'react'
import PropTypes from 'prop-types'
import getMeta from '../../utils/meta'
import { buildUrlWithDetachRole } from '../utils/url-helper'
import useCallbackHandlers from '../hooks/use-callback-handlers'
import { debugConsole } from '@/utils/debugging'

export const DetachContext = createContext()

DetachContext.Provider.propTypes = {
  value: PropTypes.shape({
    role: PropTypes.oneOf(['detacher', 'detached', null]),
    setRole: PropTypes.func.isRequired,
    broadcastEvent: PropTypes.func.isRequired,
    addEventHandler: PropTypes.func.isRequired,
    deleteEventHandler: PropTypes.func.isRequired,
  }).isRequired,
}

const debugPdfDetach = getMeta('ol-debugPdfDetach')

const projectId = getMeta('ol-project_id')
export const detachChannelId = `detach-${projectId}`
export const detachChannel =
  'BroadcastChannel' in window
    ? new BroadcastChannel(detachChannelId)
    : undefined

export function DetachProvider({ children }) {
  const [lastDetachedConnectedAt, setLastDetachedConnectedAt] = useState()
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
      const listener = event => {
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
    (event, data) => {
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
      const message = {
        role,
        event,
      }
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
    const updateLastDetachedConnectedAt = message => {
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

DetachProvider.propTypes = {
  children: PropTypes.any,
}

export function useDetachContext(propTypes) {
  const data = useContext(DetachContext)
  if (!data) {
    throw new Error('useDetachContext is only available inside DetachProvider')
  }
  PropTypes.checkPropTypes(propTypes, data, 'data', 'DetachContext.Provider')
  return data
}
