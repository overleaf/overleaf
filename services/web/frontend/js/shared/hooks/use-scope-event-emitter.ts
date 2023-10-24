import { useCallback } from 'react'
import { useIdeContext } from '../context/ide-context'
import { ScopeEventName } from '../../../../types/ide/scope-event-emitter'

export default function useScopeEventEmitter(
  eventName: ScopeEventName,
  broadcast = true
) {
  const { scopeEventEmitter } = useIdeContext()

  return useCallback(
    (...detail: unknown[]) => {
      scopeEventEmitter.emit(eventName, broadcast, ...detail)
    },
    [scopeEventEmitter, eventName, broadcast]
  )
}
