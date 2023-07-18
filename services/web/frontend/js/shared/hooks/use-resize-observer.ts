import { useCallback, useEffect, useRef } from 'react'

export const useResizeObserver = (handleResize: (element: Element) => void) => {
  const resizeRef = useRef<{
    element: Element
    observer: ResizeObserver
  } | null>(null)

  const elementRef = useCallback(
    (element: Element | null) => {
      if (element && 'ResizeObserver' in window) {
        if (resizeRef.current) {
          resizeRef.current.observer.unobserve(resizeRef.current.element)
        }

        const observer = new ResizeObserver(([entry]) => {
          handleResize(entry.target)
        })

        resizeRef.current = { element, observer }

        observer.observe(element)

        handleResize(element) // trigger the callback once
      }
    },
    [handleResize]
  )

  useEffect(() => {
    return () => {
      if (resizeRef.current) {
        resizeRef.current.observer.unobserve(resizeRef.current.element)
      }
    }
  }, [])

  return { elementRef, resizeRef }
}
