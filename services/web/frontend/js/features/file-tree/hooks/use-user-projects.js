import { useEffect, useState } from 'react'
import { getJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'
import useAbortController from '../../../shared/hooks/use-abort-controller'

const alphabetical = (a, b) => fileCollator.compare(a.name, b.name)

export function useUserProjects() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  const { signal } = useAbortController()

  useEffect(() => {
    getJSON('/user/projects', { signal })
      .then(data => {
        setData(data.projects.sort(alphabetical))
      })
      .catch(error => setError(error))
      .finally(() => setLoading(false))
  }, [signal])

  return { loading, data, error }
}
