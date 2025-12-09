import { useCallback, useEffect } from 'react'
import { useDetachContext } from '../context/detach-context'
import getMeta from '../../utils/meta'
import { debugConsole } from '@/utils/debugging'

const debugPdfDetach = getMeta('ol-debugPdfDetach')

export default function useDetachAction(
  actionName,
  actionFunction,
  senderRole,
  targetRole
) {
  const { role, broadcastEvent, addEventHandler, deleteEventHandler } =
    useDetachContext()

  const eventName = `action-${actionName}`

  const triggerFn = useCallback(
    (...args) => {
      if (role === senderRole) {
        broadcastEvent(eventName, { args })
      } else {
        return actionFunction(...args)
      }
    },
    [role, senderRole, eventName, actionFunction, broadcastEvent]
  )

  const handleActionEvent = useCallback(
    message => {
      if (message.event !== eventName) {
        return
      }
      if (role !== targetRole) {
        return
      }
      if (debugPdfDetach) {
        debugConsole.warn(`Do ${actionFunction.name} on event ${eventName}`)
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
