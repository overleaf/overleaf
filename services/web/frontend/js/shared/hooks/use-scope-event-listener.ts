import { useEffect } from 'react'
import { useIdeContext } from '../context/ide-context'
import { ScopeEventName } from '../../../../types/ide/scope-event-emitter'
import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'

export default function useScopeEventListener<T extends ScopeEventName>(
  eventName: T,
  listener: (event: Event, ...args: IdeEvents[T]) => void
) {
  const { scopeEventEmitter } = useIdeContext()

  useEffect(() => {
    return scopeEventEmitter.on(eventName, listener)
  }, [scopeEventEmitter, eventName, listener])
}
