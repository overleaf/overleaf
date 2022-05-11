import { useEffect, useState, useRef } from 'react'

const DEFAULT_TIMEOUT = 3000
const hash = window.location.hash.substring(1)
const events = <const>['keydown', 'touchmove', 'wheel']

const isKeyboardEvent = (event: Event): event is KeyboardEvent => {
  return event.constructor.name === 'KeyboardEvent'
}

type UseScrollToIdOnLoadProps = {
  timeout?: number
}

function UseScrollToIdOnLoad({
  timeout = DEFAULT_TIMEOUT,
}: UseScrollToIdOnLoadProps = {}) {
  const [offsetTop, setOffsetTop] = useState<number | null>(null)
  const requestRef = useRef<number | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)

  const cancelAnimationFrame = () => {
    if (requestRef.current) {
      window.cancelAnimationFrame(requestRef.current)
    }
  }

  const cancelEventListeners = () => {
    events.forEach(eventType => {
      window.removeEventListener(eventType, eventListenersCallbackRef.current)
    })
  }

  const eventListenersCallback = (
    event: KeyboardEvent | TouchEvent | WheelEvent
  ) => {
    const keys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'])

    if (!isKeyboardEvent(event) || keys.has(event.key)) {
      // Remove scroll checks
      cancelAnimationFrame()
      // Remove event listeners
      cancelEventListeners()
    }
  }

  const eventListenersCallbackRef = useRef(eventListenersCallback)

  // Scroll to the target
  useEffect(() => {
    if (!offsetTop) {
      return
    }

    window.scrollTo({
      top: offsetTop,
    })
  }, [offsetTop])

  // Bail out from scrolling automatically in `${timeout}` milliseconds
  useEffect(() => {
    if (!hash) {
      return
    }

    setTimeout(() => {
      cancelAnimationFrame()
      cancelEventListeners()
    }, timeout)
  }, [timeout])

  // Scroll to target by recursively looking for the target element
  useEffect(() => {
    if (!hash) {
      return
    }

    const offsetTop = () => {
      if (targetRef.current) {
        setOffsetTop(targetRef.current.offsetTop)
      } else {
        targetRef.current = document.getElementById(hash)
      }

      requestRef.current = window.requestAnimationFrame(offsetTop)
    }

    requestRef.current = window.requestAnimationFrame(offsetTop)

    return () => {
      cancelAnimationFrame()
    }
  }, [])

  // Set up the event listeners that will cancel the target element lookup
  useEffect(() => {
    if (!hash) {
      return
    }

    events.forEach(eventType => {
      window.addEventListener(eventType, eventListenersCallbackRef.current)
    })

    return () => {
      cancelEventListeners()
    }
  }, [])
}

export default UseScrollToIdOnLoad
