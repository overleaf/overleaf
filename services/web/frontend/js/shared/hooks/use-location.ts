import { useCallback, useMemo } from 'react'
import useIsMounted from './use-is-mounted'
import { location } from '@/shared/components/location'

export const useLocation = () => {
  const isMounted = useIsMounted()

  const assign = useCallback(
    (url: string) => {
      if (isMounted.current) {
        location.assign(url)
      }
    },
    [isMounted]
  )

  const replace = useCallback(
    (url: string) => {
      if (isMounted.current) {
        location.replace(url)
      }
    },
    [isMounted]
  )

  const reload = useCallback(() => {
    if (isMounted.current) {
      location.reload()
    }
  }, [isMounted])

  const setHash = useCallback(
    (hash: string) => {
      if (isMounted.current) {
        location.setHash(hash)
      }
    },
    [isMounted]
  )

  const toString = useCallback(() => {
    if (isMounted.current) {
      return location.toString()
    }
    return ''
  }, [isMounted])

  return useMemo(
    () => ({ assign, replace, reload, setHash, toString }),
    [assign, replace, reload, setHash, toString]
  )
}
