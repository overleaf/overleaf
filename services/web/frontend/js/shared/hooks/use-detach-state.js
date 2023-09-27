import { useEffect, useState, useCallback } from 'react'
import { useDetachContext } from '../context/detach-context'
import getMeta from '../../utils/meta'
import { debugConsole } from '@/utils/debugging'

const debugPdfDetach = getMeta('ol-debugPdfDetach')

export default function useDetachState(
  key,
  defaultValue,
  senderRole,
  targetRole
) {
  const [value, setValue] = useState(defaultValue)

  const {
    role,
    broadcastEvent,
    lastDetachedConnectedAt,
    addEventHandler,
    deleteEventHandler,
  } = useDetachContext()

  const eventName = `state-${key}`

  // lastDetachedConnectedAt is added as a dependency in order to re-broadcast
  // all states when a new detached tab connects
  useEffect(() => {
    if (role === senderRole) {
      broadcastEvent(eventName, { value })
    }
  }, [
    role,
    senderRole,
    eventName,
    value,
    broadcastEvent,
    lastDetachedConnectedAt,
  ])

  const handleStateEvent = useCallback(
    message => {
      if (message.event !== eventName) {
        return
      }
      if (role !== targetRole) {
        return
      }
      if (debugPdfDetach) {
        debugConsole.warn(`Set ${message.data.value} for ${eventName}`)
      }
      setValue(message.data.value)
    },
    [role, targetRole, eventName, setValue]
  )

  useEffect(() => {
    addEventHandler(handleStateEvent)
    return () => deleteEventHandler(handleStateEvent)
  }, [addEventHandler, deleteEventHandler, handleStateEvent])

  return [value, setValue]
}
