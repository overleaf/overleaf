import { useCallback, useMemo } from 'react'
import useIsMounted from './use-is-mounted'
import { location } from '@/shared/components/location'

export const useLocation = () => {
  const isMounted = useIsMounted()

  const assign = useCallback(
    url => {
      if (isMounted.current) {
        location.assign(url)
      }
    },
    [isMounted]
  )

  const reload = useCallback(() => {
    if (isMounted.current) {
      location.reload()
    }
  }, [isMounted])

  return useMemo(() => ({ assign, reload }), [assign, reload])
}
