import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'

export type ScopeEventName = keyof IdeEvents

export interface ScopeEventEmitter {
  emit: (
    eventName: ScopeEventName,
    broadcast: boolean,
    ...detail: unknown[]
  ) => void
  on: (
    eventName: ScopeEventName,
    listener: (...args: unknown[]) => void
  ) => () => void
}
