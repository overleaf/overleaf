import { useCallback, useEffect } from 'react'
import { useDetachContext } from '../context/detach-context'
import getMeta from '../../utils/meta'
import { DetachRole, DetachTargetRole, Message } from './use-detach-state'

const debugPdfDetach = getMeta('ol-debugPdfDetach')

function useDetachAction<
  A,
  S extends DetachRole,
  T extends DetachTargetRole<S>
>(
  actionName: string,
  actionFunction: (...args: A[]) => void,
  senderRole: S,
  targetRole: T
) {
  const { role, broadcastEvent, addEventHandler, deleteEventHandler } =
    useDetachContext()

  const eventName: Message['event'] = `action-${actionName}`

  const triggerFn = useCallback(
    (...args: A[]) => {
      if (role === senderRole) {
        broadcastEvent(eventName, { args })
      } else {
        actionFunction(...args)
      }
    },
    [role, senderRole, eventName, actionFunction, broadcastEvent]
  )

  const handleActionEvent = useCallback(
    (message: Message<A>) => {
      if (message.event !== eventName) {
        return
      }
      if (role !== targetRole) {
        return
      }
      if (debugPdfDetach) {
        console.log(`Do ${actionFunction.name} on event ${eventName}`)
      }
      actionFunction(...message.data.args)
    },
    [role, targetRole, eventName, actionFunction]
  )

  useEffect(() => {
    addEventHandler(handleActionEvent)
    return () => deleteEventHandler(handleActionEvent)
  }, [addEventHandler, deleteEventHandler, handleActionEvent])

  return triggerFn
}

export default useDetachAction
