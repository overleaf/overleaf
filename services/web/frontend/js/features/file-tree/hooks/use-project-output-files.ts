import { useEffect, useState } from 'react'
import { postJSON } from '../../../infrastructure/fetch-json'
import { fileCollator } from '../util/file-collator'
import useAbortController from '../../../shared/hooks/use-abort-controller'

export type OutputEntity = {
  path: string
  clsiServerId: string
  compileGroup: string
  build: string
}

const alphabetical = (a: OutputEntity, b: OutputEntity) =>
  fileCollator.compare(a.path, b.path)

export function useProjectOutputFiles(projectId?: string) {
  const [loading, setLoading] = useState<boolean>(false)
  const [data, setData] = useState<OutputEntity[] | null>(null)
  const [error, setError] = useState<any>(false)

  const { signal } = useAbortController()

  useEffect(() => {
    if (projectId) {
      setLoading(true)
      setError(false)
      setData(null)

      postJSON(`/project/${projectId}/compile`, {
        body: {
          check: 'silent',
          draft: false,
          incrementalCompilesEnabled: false,
        },
        signal,
      })
        .then(data => {
          if (data.status === 'success') {
            const filteredFiles = data.outputFiles.filter(
              (file: OutputEntity) =>
                file.path.match(/.*\.(pdf|png|jpeg|jpg|gif)/)
            )
            data.outputFiles.forEach((file: OutputEntity) => {
              file.clsiServerId = data.clsiServerId
              file.compileGroup = data.compileGroup
            })
            setData(filteredFiles.sort(alphabetical))
          } else {
            setError('linked-project-compile-error')
          }
        })
        .catch(error => setError(error))
        .finally(() => setLoading(false))
    }
  }, [projectId, signal])

  return { loading, data, error }
}
