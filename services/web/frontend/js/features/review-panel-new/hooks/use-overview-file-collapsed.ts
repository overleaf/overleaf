import { useCallback } from 'react'
import { DocId } from '../../../../../types/project-settings'
import { useProjectContext } from '../../../shared/context/project-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'

export default function useOverviewFileCollapsed(docId: DocId) {
  const { _id: projectId } = useProjectContext()
  const [collapsedDocs, setCollapsedDocs] = usePersistedState<
    Record<DocId, boolean>
  >(`docs_collapsed_state:${projectId}`, {}, false, true)

  const toggleCollapsed = useCallback(() => {
    setCollapsedDocs((collapsedDocs: Record<DocId, boolean>) => {
      return {
        ...collapsedDocs,
        [docId]: !collapsedDocs[docId],
      }
    })
  }, [docId, setCollapsedDocs])

  return { collapsed: collapsedDocs[docId], toggleCollapsed }
}
