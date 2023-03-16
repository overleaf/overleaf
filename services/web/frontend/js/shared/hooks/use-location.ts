import { useCallback, useMemo } from 'react'
import useIsMounted from './use-is-mounted'

export const useLocation = () => {
  const isMounted = useIsMounted()

  const assign = useCallback(
    url => {
      if (isMounted.current) {
        // eslint-disable-next-line no-restricted-syntax
        window.location.assign(url)
      }
    },
    [isMounted]
  )

  const reload = useCallback(() => {
    if (isMounted.current) {
      // eslint-disable-next-line no-restricted-syntax
      window.location.reload()
    }
  }, [isMounted])

  return useMemo(() => ({ assign, reload }), [assign, reload])
}
