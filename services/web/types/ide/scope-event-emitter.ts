import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'

export type ScopeEventName = keyof IdeEvents

export interface ScopeEventEmitter {
  emit: <T extends ScopeEventName>(
    eventName: T,
    broadcast: boolean,
    ...detail: IdeEvents[T]
  ) => void
  on: <T extends ScopeEventName>(
    eventName: T,
    listener: (event: Event, ...args: IdeEvents[T]) => void
  ) => () => void
}
