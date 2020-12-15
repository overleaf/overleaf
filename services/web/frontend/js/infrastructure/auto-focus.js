import { createRef, useEffect } from 'react'

export function useRefWithAutoFocus() {
  const autoFocusedRef = createRef()

  useEffect(() => {
    if (autoFocusedRef.current) {
      requestAnimationFrame(() => {
        if (autoFocusedRef.current) autoFocusedRef.current.focus()
      })
    }
  }, [autoFocusedRef])

  return { autoFocusedRef }
}
