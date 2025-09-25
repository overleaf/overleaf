import { FC, useEffect, useState } from 'react'
import { ServerWordCountData } from '@/features/word-count-modal/components/word-count-data'
import { WordCountError } from '@/features/word-count-modal/components/word-count-error'
import { useProjectContext } from '@/shared/context/project-context'
import { useLocalCompileContext } from '@/shared/context/local-compile-context'
import useAbortController from '@/shared/hooks/use-abort-controller'
import { getJSON } from '@/infrastructure/fetch-json'
import { debugConsole } from '@/utils/debugging'
import { WordCounts } from '@/features/word-count-modal/components/word-counts'
import LoadingSpinner from '@/shared/components/loading-spinner'

export const WordCountServer: FC = () => {
  const { projectId } = useProjectContext()
  const { clsiServerId } = useLocalCompileContext()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [data, setData] = useState<ServerWordCountData | null>(null)

  const { signal } = useAbortController()

  useEffect(() => {
    const url = new URL(`/project/${projectId}/wordcount`, window.location.href)
    if (clsiServerId) {
      url.searchParams.set('clsiserverid', clsiServerId)
    }

    getJSON(url.toString(), { signal })
      .then(data => {
        setData(data.texcount)
      })
      .catch(error => {
        debugConsole.error(error)
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [projectId, clsiServerId, signal])

  return (
    <>
      {loading && !error && <LoadingSpinner />}
      {error && <WordCountError />}
      {data && <WordCounts data={data} />}
    </>
  )
}
