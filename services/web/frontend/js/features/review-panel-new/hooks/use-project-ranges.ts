import { useEffect, useState } from 'react'
import { Ranges } from '../context/ranges-context'
import { useProjectContext } from '@/shared/context/project-context'
import { getJSON } from '@/infrastructure/fetch-json'

export default function useProjectRanges() {
  const { _id: projectId } = useProjectContext()
  const [error, setError] = useState<Error>()
  const [projectRanges, setProjectRanges] = useState<Map<string, Ranges>>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getJSON<{ id: string; ranges: Ranges }[]>(`/project/${projectId}/ranges`)
      .then(data => {
        setProjectRanges(
          new Map(
            data.map(item => [
              item.id,
              {
                docId: item.id,
                changes: item.ranges.changes ?? [],
                comments: item.ranges.comments ?? [],
                total: 0, // TODO
              },
            ])
          )
        )
      })
      .catch(error => setError(error))
      .finally(() => setLoading(false))
  }, [projectId])

  return { projectRanges, error, loading }
}
