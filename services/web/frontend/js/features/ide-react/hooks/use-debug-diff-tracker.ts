import { useEffect, useMemo, useRef } from 'react'
import { DocumentContainer } from '../editor/document-container'
import { DocId } from '../../../../../types/project-settings'
import { debugConsole } from '@/utils/debugging'
import { diffChars } from 'diff'

const DIFF_TIMEOUT_MS = 5000

async function tryGetDiffSize(
  currentContents: string | null | undefined,
  projectId: string | null,
  docId: DocId | null | undefined
): Promise<number | null> {
  debugConsole.debug('tryGetDiffSize')
  // If we don't know the current content or id, there's not much we can do
  if (!projectId) {
    debugConsole.debug('tryGetDiffSize: missing projectId')
    return null
  }
  if (!currentContents) {
    debugConsole.debug('tryGetDiffSize: missing currentContents')
    return null
  }
  if (!docId) {
    debugConsole.debug('tryGetDiffSize: missing docId')
    return null
  }
  try {
    const response = await fetch(
      `/Project/${projectId}/doc/${docId}/download`,
      { signal: AbortSignal.timeout(DIFF_TIMEOUT_MS) }
    )
    const serverContent = await response.text()

    const differences = diffChars(serverContent, currentContents)
    let diffSize = 0
    for (const diff of differences) {
      if (diff.added || diff.removed) {
        diffSize += diff.value.length
      }
    }
    return diffSize
  } catch {
    // There's a good chance we're offline, so just return null
    debugConsole.debug('tryGetDiffSize: fetch failed')
    return null
  }
}

export const useDebugDiffTracker = (
  projectId: string,
  currentDocument: DocumentContainer | null
) => {
  const debugCurrentDocument = useRef<DocumentContainer | null>(null)
  const debugProjectId = useRef<string | null>(null)
  const debugTimers = useRef<Record<string, number>>({})

  useEffect(() => {
    debugCurrentDocument.current = currentDocument
  }, [currentDocument])
  useEffect(() => {
    debugProjectId.current = projectId
  }, [projectId])

  const createDebugDiff = useMemo(
    () => async () =>
      await tryGetDiffSize(
        debugCurrentDocument.current?.getSnapshot(),
        debugProjectId.current,
        debugCurrentDocument.current?.doc_id as DocId | undefined
      ),
    []
  )

  return {
    createDebugDiff,
    debugTimers,
  }
}
