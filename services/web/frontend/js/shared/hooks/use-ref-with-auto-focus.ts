import { useRef, useEffect } from 'react'

export function useRefWithAutoFocus<T extends HTMLElement = HTMLElement>() {
  const autoFocusedRef = useRef<T>(null)

  useEffect(() => {
    if (autoFocusedRef.current) {
      window.requestAnimationFrame(() => {
        if (autoFocusedRef.current) {
          autoFocusedRef.current.focus()
        }
      })
    }
  }, [])

  return { autoFocusedRef }
}
