import {
  ScopeEventEmitter,
  ScopeEventName,
} from '../../../../../types/ide/scope-event-emitter'

export class ReactScopeEventEmitter implements ScopeEventEmitter {
  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly eventEmitter: EventTarget) {}

  emit(eventName: ScopeEventName, broadcast: boolean, ...detail: unknown[]) {
    this.eventEmitter.dispatchEvent(new CustomEvent(eventName, { detail }))
  }

  on(eventName: ScopeEventName, listener: (...args: unknown[]) => void) {
    // A listener attached via useScopeEventListener expects an event as the
    // first parameter. We don't have one, so just provide an empty object
    const wrappedListener = (event: CustomEvent<unknown[]>) => {
      listener({}, ...event.detail)
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
