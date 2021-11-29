import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import classnames from 'classnames'

const measureContentWidth = element =>
  [...element.querySelectorAll('button')].reduce(
    (output, item) => output + item.scrollWidth,
    0
  )

export default function useToolbarBreakpoint(element) {
  const [breakpoint, setBreakpoint] = useState(2)
  const [recalculate, setRecalculate] = useState(true)

  const [resizeObserver] = useState(() => {
    if ('ResizeObserver' in window) {
      return new ResizeObserver(() => {
        setBreakpoint(2)
        setRecalculate(true)
      })
    }
  })

  const [mutationObserver] = useState(
    () =>
      new MutationObserver(() => {
        setBreakpoint(2)
        setRecalculate(true)
      })
  )

  useEffect(() => {
    if (element && mutationObserver && resizeObserver) {
      resizeObserver.observe(element)

      mutationObserver.observe(element, {
        childList: true,
        subtree: true,
        characterData: true,
      })

      return () => {
        mutationObserver.disconnect()
        resizeObserver.disconnect()
      }
    }
  }, [element, mutationObserver, resizeObserver])

  useLayoutEffect(() => {
    if (recalculate && element && breakpoint) {
      const contentWidth = measureContentWidth(element) + 150 // NOTE: remove this constant?

      if (contentWidth > element.clientWidth) {
        setBreakpoint(value => value - 1)
      } else {
        setRecalculate(false)
      }
    }
  }, [element, breakpoint, recalculate])

  return useMemo(
    () =>
      classnames({
        toolbar: true,
        'toolbar-pdf': true,
        'toolbar-large': breakpoint === 2,
        'toolbar-medium': breakpoint === 1,
        'toolbar-small': breakpoint === 0,
      }),
    [breakpoint]
  )
}
