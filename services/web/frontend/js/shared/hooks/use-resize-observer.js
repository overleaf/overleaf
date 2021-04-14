import { useLayoutEffect, useRef, useCallback } from 'react'

function useResizeObserver(observedElement, observedData, callback) {
  const resizeObserver = useRef()

  const observe = useCallback(() => {
    resizeObserver.current = new ResizeObserver(function (elementsObserved) {
      callback(elementsObserved[0])
    })
  }, [callback])

  function unobserve(observedCurrent) {
    resizeObserver.current.unobserve(observedCurrent)
  }

  useLayoutEffect(() => {
    if ('ResizeObserver' in window) {
      const observedCurrent = observedElement && observedElement.current
      if (observedCurrent) {
        observe(observedElement.current)
      }

      if (resizeObserver.current && observedCurrent) {
        resizeObserver.current.observe(observedCurrent)
      }

      return () => {
        if (observedCurrent) {
          unobserve(observedCurrent)
        }
      }
    }
  }, [observedElement, observedData, observe])
}

export default useResizeObserver
