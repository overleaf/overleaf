import { useLayoutEffect, useRef } from 'react'

export default function useIsMounted() {
  const mounted = useRef(false)

  useLayoutEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [mounted])

  return mounted
}
