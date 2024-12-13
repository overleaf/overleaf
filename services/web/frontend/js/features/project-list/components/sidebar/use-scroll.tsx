import { throttle } from 'lodash'
import { useEffect, useRef, useState } from 'react'

export const useScrolled = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrolledUp, setScrolledUp] = useState(false)
  const [scrolledDown, setScrolledDown] = useState(false)

  const checkScrollPosition = useRef(
    throttle(() => {
      const container = containerRef.current
      if (!container) {
        return
      }
      setScrolledDown(container.scrollTop > 0)
      const isAtBottom =
        Math.abs(
          // On Firefox, this value happen to be at 1 when scrolled to the bottom
          container.scrollHeight - container.clientHeight - container.scrollTop
        ) <= 1
      setScrolledUp(!isAtBottom)
    }, 80)
  ).current

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    checkScrollPosition()
    container.addEventListener('scroll', checkScrollPosition)
    return () => {
      checkScrollPosition.cancel()
      container.removeEventListener('scroll', checkScrollPosition)
    }
  }, [checkScrollPosition])

  return { containerRef, scrolledDown, scrolledUp }
}
