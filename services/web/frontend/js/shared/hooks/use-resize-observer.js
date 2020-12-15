import { useLayoutEffect, useRef } from 'react'

function useResizeObserver(observedElement, observedData, callback) {
  const resizeObserver = useRef()

  function observe() {
    resizeObserver.current = new ResizeObserver(function(elementsObserved) {
      callback(elementsObserved[0])
    })
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observedElement, observedData])
}

export default useResizeObserver
