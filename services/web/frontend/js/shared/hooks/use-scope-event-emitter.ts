import { useCallback } from 'react'
import { useIdeContext } from '../context/ide-context'
import { ScopeEventName } from '../../../../types/ide/scope-event-emitter'
import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'

export default function useScopeEventEmitter<T extends ScopeEventName>(
  eventName: T,
  broadcast = true
) {
  const { scopeEventEmitter } = useIdeContext()

  return useCallback(
    (...detail: IdeEvents[T]) => {
      scopeEventEmitter.emit(eventName, broadcast, ...detail)
    },
    [scopeEventEmitter, eventName, broadcast]
  )
}
