import { useLayoutEffect } from 'react'
import fetchMock from 'fetch-mock'
fetchMock.config.fallbackToNetwork = true

/**
 * Run callback to mock fetch routes, call restore() when unmounted
 */
export default function useFetchMock(
  callback: (value: typeof fetchMock) => void
) {
  useLayoutEffect(() => {
    callback(fetchMock)

    return () => {
      fetchMock.restore()
    }
  }, [callback])
}
