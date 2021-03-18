import { useEffect, useState } from 'react'
import { getJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'

const alphabetical = (a, b) => fileCollator.compare(a.path, b.path)

export function useProjectEntities(projectId) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (projectId) {
      setLoading(true)
      setError(false)
      setData(null)

      getJSON(`/project/${projectId}/entities`)
        .then(data => {
          setData(data.entities.sort(alphabetical))
        })
        .catch(error => setError(error))
        .finally(() => setLoading(false))
    }
  }, [projectId])

  return { loading, data, error }
}
