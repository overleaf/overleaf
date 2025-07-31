import { useCallback } from 'react'
import { DocId } from '../../../../../types/project-settings'
import { useProjectContext } from '../../../shared/context/project-context'
import usePersistedState from '../../../shared/hooks/use-persisted-state'
import { debugConsole } from '@/utils/debugging'

const safeStringify = (value: unknown) => {
  try {
    return JSON.stringify(value)
  } catch (e) {
    debugConsole.error('double stringify exception', e)
    return ''
  }
}

const safeParse = (value: string) => {
  try {
    return JSON.parse(value)
  } catch (e) {
    debugConsole.error('double parse exception', e)
    return null
  }
}

export default function useOverviewFileCollapsed(docId: DocId) {
  const { projectId } = useProjectContext()
  const [collapsedDocs, setCollapsedDocs] = usePersistedState<
    Record<DocId, boolean>,
    string
  >(
    `docs_collapsed_state:${projectId}`,
    {},
    {
      converter: {
        fromPersisted: safeParse,
        toPersisted: safeStringify,
      },
    }
  )

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
