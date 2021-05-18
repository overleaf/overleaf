import { useRef, useEffect } from 'react'

export function useRefWithAutoFocus() {
  const autoFocusedRef = useRef()

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
