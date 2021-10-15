import { useCallback, useEffect, useRef } from 'react'

export const useResizeObserver = handleResize => {
  const resizeRef = useRef(null)

  const elementRef = useCallback(
    element => {
      if (element) {
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

  return elementRef
}
