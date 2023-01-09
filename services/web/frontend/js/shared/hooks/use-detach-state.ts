import { useEffect, useState, useCallback } from 'react'
import { useDetachContext } from '../context/detach-context'
import getMeta from '../../utils/meta'

const debugPdfDetach = getMeta('ol-debugPdfDetach')

export type DetachRole = 'detacher' | 'detached'
export type DetachTargetRole<T extends DetachRole> = T extends 'detacher'
  ? 'detached'
  : 'detacher'
export type Message<DataArgs = unknown> = {
  event: `${'action' | 'state'}-${string}`
  data: {
    args: DataArgs[]
    value: unknown
  }
}

function useDetachState<S extends DetachRole, T extends DetachTargetRole<S>>(
  key: string,
  defaultValue: unknown,
  senderRole: S,
  targetRole: T
): [unknown, React.Dispatch<unknown>] {
  const [value, setValue] = useState(defaultValue)

  const {
    role,
    broadcastEvent,
    lastDetachedConnectedAt,
    addEventHandler,
    deleteEventHandler,
  } = useDetachContext()

  const eventName: Message['event'] = `state-${key}`

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
    (message: Message) => {
      if (message.event !== eventName) {
        return
      }
      if (role !== targetRole) {
        return
      }
      if (debugPdfDetach) {
        console.log(`Set ${message.data.value} for ${eventName}`)
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

export default useDetachState
