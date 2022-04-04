import { useEffect } from 'react'
import fetchMock from 'fetch-mock'
fetchMock.config.fallbackToNetwork = true

/**
 * Run callback to mock fetch routes, call restore() when unmounted
 */
export default function useFetchMock(callback) {
  useEffect(() => {
    return () => {
      fetchMock.restore()
    }
  }, [])

  // Running fetchMock.restore() here as well,
  // in case there was an error before the component was unmounted.
  fetchMock.restore()

  // The callback has to be run here, rather than in useEffect,
  // so it's run before the component is rendered.
  callback(fetchMock)
}
