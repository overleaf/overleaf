import { useEffect } from 'react'
import { useIdeContext } from '../context/ide-context'
import { ScopeEventName } from '../../../../types/ide/scope-event-emitter'

export default function useScopeEventListener(
  eventName: ScopeEventName,
  listener: (...args: unknown[]) => void
) {
  const { scopeEventEmitter } = useIdeContext()

  useEffect(() => {
    return scopeEventEmitter.on(eventName, listener)
  }, [scopeEventEmitter, eventName, listener])
}
