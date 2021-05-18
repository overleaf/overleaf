import { useEffect, useRef } from 'react'

export default function useIsMounted() {
  const isMounted = useRef(true)

  useEffect(() => {
    return () => {
      isMounted.current = false
    }
  }, [isMounted])

  return isMounted
}
