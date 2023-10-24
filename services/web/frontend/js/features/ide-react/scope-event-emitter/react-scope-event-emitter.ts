import {
  ScopeEventEmitter,
  ScopeEventName,
} from '../../../../../types/ide/scope-event-emitter'
import EventEmitter from 'events'

export class ReactScopeEventEmitter implements ScopeEventEmitter {
  // eslint-disable-next-line no-useless-constructor
  constructor(private readonly eventEmitter: EventEmitter) {}

  emit(eventName: ScopeEventName, broadcast: boolean, ...detail: unknown[]) {
    this.eventEmitter.emit(eventName, ...detail)
  }

  on(eventName: ScopeEventName, listener: (...args: unknown[]) => void) {
    // A listener attached via useScopeEventListener expects an event as the
    // first parameter. We don't have one, so just provide an empty object
    const wrappedListener = (...detail: unknown[]) => {
      listener({}, ...detail)
    }
    this.eventEmitter.on(eventName, wrappedListener)
    return () => {
      this.eventEmitter.off(eventName, wrappedListener)
    }
  }
}
