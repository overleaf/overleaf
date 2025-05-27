import { useLayoutEffect } from 'react'
import fetchMock from 'fetch-mock'

/**
 * Run callback to mock fetch routes, call removeRoutes() and unmockGlobal() when unmounted
 */
export default function useFetchMock(
  callback: (value: typeof fetchMock) => void
) {
  fetchMock.mockGlobal()

  useLayoutEffect(() => {
    fetchMock.mockGlobal()
    callback(fetchMock)
    return () => {
      fetchMock.removeRoutes()
      fetchMock.unmockGlobal()
    }
  }, [callback])
}
