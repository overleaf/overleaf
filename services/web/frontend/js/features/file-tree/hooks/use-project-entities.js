import { useEffect, useState } from 'react'
import { getJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'
import useAbortController from '../../../shared/hooks/use-abort-controller'

const alphabetical = (a, b) => fileCollator.compare(a.path, b.path)

export function useProjectEntities(projectId) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  const { signal } = useAbortController()

  useEffect(() => {
    if (projectId) {
      setLoading(true)
      setError(false)
      setData(null)

      getJSON(`/project/${projectId}/entities`, { signal })
        .then(data => {
          setData(data.entities.sort(alphabetical))
        })
        .catch(error => setError(error))
        .finally(() => setLoading(false))
    }
  }, [projectId, signal])

  return { loading, data, error }
}
