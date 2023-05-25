import { useRef, useEffect, useCallback, useState } from 'react'

export function useRefWithAutoFocus<T extends HTMLElement = HTMLElement>() {
  const autoFocusedRef = useRef<T>(null)
  const [hasFocused, setHasFocused] = useState(false)
  const resetAutoFocus = useCallback(() => setHasFocused(false), [])

  // Run on every render but use hasFocused to ensure that the autofocus only
  // happens once
  useEffect(() => {
    if (hasFocused) {
      return
    }

    let request: number | null = null
    if (autoFocusedRef.current) {
      request = window.requestAnimationFrame(() => {
        if (autoFocusedRef.current) {
          autoFocusedRef.current.focus()
          setHasFocused(true)
          request = null
        }
      })
    }

    // Cancel a pending autofocus prior to autofocus actually happening on
    // render, and on unmount
    return () => {
      if (request !== null) {
        window.cancelAnimationFrame(request)
      }
    }
  })

  return { autoFocusedRef, resetAutoFocus }
}
