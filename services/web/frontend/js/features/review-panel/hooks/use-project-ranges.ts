import { useCallback, useEffect, useState } from 'react'
import { Ranges } from '../context/ranges-context'
import { useProjectContext } from '@/shared/context/project-context'
import { getJSON } from '@/infrastructure/fetch-json'
import useSocketListener from '@/features/ide-react/hooks/use-socket-listener'
import { useConnectionContext } from '@/features/ide-react/context/connection-context'
import getMeta from '@/utils/meta'
import { buildProjectRangesFromSnapshot } from '@/features/review-panel/utils/snapshot-ranges'

export default function useProjectRanges() {
  const { projectId } = useProjectContext()
  const [error, setError] = useState<Error>()
  const [projectRanges, setProjectRanges] = useState<Map<string, Ranges>>()
  const [loading, setLoading] = useState(true)
  const { socket } = useConnectionContext()
  const otMigrationStage = getMeta('ol-otMigrationStage')
  const { projectSnapshot } = useProjectContext()

  useEffect(() => {
    if (otMigrationStage === 1) {
      projectSnapshot.refresh().then(() => {
        setProjectRanges(buildProjectRangesFromSnapshot(projectSnapshot))
        setLoading(false)
      })
    } else {
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
    }
  }, [projectId, otMigrationStage, projectSnapshot])

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

  useSocketListener(
    socket,
    'new-comment',
    useCallback(() => {
      if (otMigrationStage === 1) {
        projectSnapshot.refresh().then(() => {
          setProjectRanges(buildProjectRangesFromSnapshot(projectSnapshot))
          setLoading(false)
        })
      }
    }, [otMigrationStage, projectSnapshot])
  )

  return { projectRanges, error, loading }
}
