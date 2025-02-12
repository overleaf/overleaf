import { useLayoutEffect, useRef, useCallback, RefObject } from 'react'

function useResizeObserver(
  observedElement: RefObject<HTMLElement>,
  observedData: any,
  callback: (observedElement: ResizeObserverEntry) => void
) {
  const resizeObserver = useRef<ResizeObserver>()

  const observe = useCallback(() => {
    resizeObserver.current = new ResizeObserver(function (elementsObserved) {
      callback(elementsObserved[0])
    })
  }, [callback])

  function unobserve(observedCurrent: HTMLElement) {
    if (resizeObserver.current) {
      resizeObserver.current.unobserve(observedCurrent)
    }
  }

  useLayoutEffect(() => {
    if ('ResizeObserver' in window) {
      const observedCurrent = observedElement && observedElement.current
      if (observedCurrent) {
        observe()
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
