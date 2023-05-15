import { useEffect, useState } from 'react'
import { getJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'
import useAbortController from '../../../shared/hooks/use-abort-controller'

export type Entity = {
  path: string
}

const alphabetical = (a: Entity, b: Entity) =>
  fileCollator.compare(a.path, b.path)

export function useProjectEntities(projectId?: string) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Entity[] | null>(null)
  const [error, setError] = useState<any>(false)

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
