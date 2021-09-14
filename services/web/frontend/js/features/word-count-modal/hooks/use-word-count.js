import useAbortController from '../../../shared/hooks/use-abort-controller'
import { fetchWordCount } from '../utils/api'
import { useEffect, useState } from 'react'

export function useWordCount(projectId, clsiServerId) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState()

  const { signal } = useAbortController()

  useEffect(() => {
    fetchWordCount(projectId, clsiServerId, { signal })
      .then(data => {
        setData(data.texcount)
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [signal, clsiServerId, projectId])

  return { data, error, loading }
}
