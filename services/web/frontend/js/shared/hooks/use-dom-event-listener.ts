import { useEffect } from 'react'

// The use of the EventListener type means that this can only be used for
// built-in DOM event types rather than custom events.
// There are libraries such as usehooks-ts that provide hooks like this with
// support for type-safe custom events that we may want to look into.
export default function useDomEventListener(
  eventTarget: EventTarget,
  eventName: string,
  listener: EventListener
) {
  useEffect(() => {
    eventTarget.addEventListener(eventName, listener)

    return () => {
      eventTarget.removeEventListener(eventName, listener)
    }
  }, [eventTarget, eventName, listener])
}
