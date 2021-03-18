import { useEffect, useState } from 'react'
import { postJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'

const alphabetical = (a, b) => fileCollator.compare(a.path, b.path)

export function useProjectOutputFiles(projectId) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (projectId) {
      setLoading(true)
      setError(false)
      setData(null)

      postJSON(`/project/${projectId}/compile`, {
        body: {
          check: 'silent',
          draft: false,
          incrementalCompilesEnabled: false
        }
      })
        .then(data => {
          if (data.status === 'success') {
            const filteredFiles = data.outputFiles.filter(file =>
              file.path.match(/.*\.(pdf|png|jpeg|jpg|gif)/)
            )

            setData(filteredFiles.sort(alphabetical))
          } else {
            setError(true)
          }
        })
        .catch(error => setError(error))
        .finally(() => setLoading(false))
    }
  }, [projectId])

  return { loading, data, error }
}
