import {
  ScopeEventEmitter,
  ScopeEventName,
} from '../../../../../types/ide/scope-event-emitter'
import { IdeEvents } from '@/features/ide-react/create-ide-event-emitter'

export class ReactScopeEventEmitter implements ScopeEventEmitter {
  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly eventEmitter: EventTarget) {}

  emit<T extends ScopeEventName>(
    eventName: T,
    broadcast: boolean,
    ...detail: IdeEvents[T]
  ) {
    this.eventEmitter.dispatchEvent(new CustomEvent(eventName, { detail }))
  }

  on<T extends ScopeEventName>(
    eventName: T,
    listener: (event: Event, ...args: IdeEvents[T]) => void
  ) {
    const wrappedListener = (event: CustomEvent<IdeEvents[T]>) => {
      listener(event, ...event.detail)
    }
    this.eventEmitter.addEventListener(
      eventName,
      wrappedListener as EventListener
    )
    return () => {
      this.eventEmitter.removeEventListener(
        eventName,
        wrappedListener as EventListener
      )
    }
  }
}
