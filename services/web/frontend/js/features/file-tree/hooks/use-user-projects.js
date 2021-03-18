import { useEffect, useState } from 'react'
import { getJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'

const alphabetical = (a, b) => fileCollator.compare(a.name, b.name)

export function useUserProjects() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    getJSON('/user/projects')
      .then(data => {
        setData(data.projects.sort(alphabetical))
      })
      .catch(error => setError(error))
      .finally(() => setLoading(false))
  }, [])

  return { loading, data, error }
}
