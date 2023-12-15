import { useState, useEffect } from 'react'

function useLayoutToLeft(querySelector: string) {
  const [layoutToLeft, setLayoutToLeft] = useState(false)

  useEffect(() => {
    if (!('ResizeObserver' in window)) return

    const target = document.querySelector(querySelector)

    if (!target) return

    const handleResize = () => {
      const docWidth = document.documentElement.clientWidth
      const { right: rightEdge } = target.getBoundingClientRect()
      setLayoutToLeft(docWidth - rightEdge < 225)
    }

    handleResize()

    const observer = new ResizeObserver(handleResize)
    observer.observe(target)

    return () => {
      observer.disconnect()
    }
  }, [querySelector])

  return layoutToLeft
}

export default useLayoutToLeft
