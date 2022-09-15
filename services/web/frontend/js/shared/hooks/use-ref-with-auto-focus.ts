import { useRef, useEffect } from 'react'

export function useRefWithAutoFocus<T extends HTMLElement = any>() {
  const autoFocusedRef = useRef<T>(null)

  useEffect(() => {
    if (autoFocusedRef.current) {
      window.requestAnimationFrame(() => {
        if (autoFocusedRef.current) {
          autoFocusedRef.current.focus()
        }
      })
    }
  }, [autoFocusedRef])

  return { autoFocusedRef }
}
