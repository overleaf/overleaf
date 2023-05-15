import { useEffect, useState } from 'react'
import { getJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'
import useAbortController from '../../../shared/hooks/use-abort-controller'

export type Project = {
  _id: string
  name: string
  accessLevel: string
}

const alphabetical = (a: Project, b: Project) =>
  fileCollator.compare(a.name, b.name)

export function useUserProjects() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<Project[] | null>(null)
  const [error, setError] = useState<any>(false)

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
