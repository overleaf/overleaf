import { useCallback, useEffect, useState } from 'react'
import { Ranges } from '../context/ranges-context'
import { useProjectContext } from '@/shared/context/project-context'
import { getJSON } from '@/infrastructure/fetch-json'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'

export default function useProjectRanges() {
  const { _id: projectId } = useProjectContext()
  const [error, setError] = useState<Error>()
  const [projectRanges, setProjectRanges] = useState<Map<string, Ranges>>()
  const [loading, setLoading] = useState(true)
  const { socket } = useConnectionContext()

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
              },
            ])
          )
        )
      })
      .catch(error => setError(error))
      .finally(() => setLoading(false))
  }, [projectId])

  useSocketListener(
    socket,
    'accept-changes',
    useCallback((docId: string, entryIds: string[]) => {
      setProjectRanges(prevProjectRanges => {
        if (!prevProjectRanges) {
          return prevProjectRanges
        }

        const ranges = prevProjectRanges.get(docId)
        if (!ranges) {
          return prevProjectRanges
        }
        const updatedProjectRanges = new Map(prevProjectRanges)

        updatedProjectRanges.set(docId, {
          ...ranges,
          changes: ranges.changes.filter(
            change => !entryIds.includes(change.id)
          ),
        })

        return updatedProjectRanges
      })
    }, [])
  )

  return { projectRanges, error, loading }
}
