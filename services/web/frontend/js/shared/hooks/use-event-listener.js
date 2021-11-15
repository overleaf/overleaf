import { useEffect } from 'react'

/**
 * @param {string} eventName
 * @param {function} [listener]
 */
export default function useEventListener(eventName, listener) {
  useEffect(() => {
    window.addEventListener(eventName, listener)

    return () => {
      window.removeEventListener(eventName, listener)
    }
  }, [eventName, listener])
}
