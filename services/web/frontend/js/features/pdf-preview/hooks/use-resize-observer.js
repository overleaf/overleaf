import { useCallback, useEffect, useRef } from 'react'

export const useResizeObserver = callback => {
  const resizeRef = useRef(null)

  const elementRef = useCallback(
    element => {
      if (element) {
        if (resizeRef.current) {
          resizeRef.current.observer.unobserve(resizeRef.current.element)
        }

        const observer = new ResizeObserver(([entry]) => {
          callback(entry)
        })

        resizeRef.current = { element, observer }

        observer.observe(element)
      }
    },
    [callback]
  )

  useEffect(() => {
    return () => {
      if (resizeRef.current) {
        resizeRef.current.observer.unobserve(resizeRef.current.element)
      }
    }
  }, [])

  return elementRef
}
