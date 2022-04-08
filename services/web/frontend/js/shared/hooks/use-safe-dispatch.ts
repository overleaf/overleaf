import * as React from 'react'
import useIsMounted from './use-is-mounted'

function useSafeDispatch<T>(dispatch: React.Dispatch<T>) {
  const mounted = useIsMounted()

  return React.useCallback<(args: T) => void>(
    action => {
      if (mounted.current) {
        dispatch(action)
      }
    },
    [dispatch, mounted]
  ) as React.Dispatch<T>
}

export default useSafeDispatch
