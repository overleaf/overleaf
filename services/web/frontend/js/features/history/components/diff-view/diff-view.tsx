import { useEffect, useMemo } from 'react'
import Toolbar from './toolbar/toolbar'
import Main from './main'
import { Diff, DocDiffResponse } from '../../services/types/doc'
import { useHistoryContext } from '../../context/history-context'
import { diffDoc } from '../../services/api'
import { highlightsFromDiffResponse } from '../../utils/highlights-from-diff-response'
import { useErrorBoundary } from 'react-error-boundary'
import useAsync from '../../../../shared/hooks/use-async'
import { useTranslation } from 'react-i18next'

function DiffView() {
  const { selection, projectId, loadingFileDiffs, updatesInfo } =
    useHistoryContext()
  const { isLoading, data, runAsync } = useAsync<DocDiffResponse>()
  const { t } = useTranslation()
  const { updateRange, selectedFile } = selection
  const { showBoundary } = useErrorBoundary()

  const isCurrentVersion =
    !!updateRange && updatesInfo.updates[0].toV === updateRange.toV

  useEffect(() => {
    if (!updateRange || !selectedFile?.pathname || loadingFileDiffs) {
      return
    }

    const { fromV, toV } = updateRange
    let abortController: AbortController | null = new AbortController()

    runAsync(
      diffDoc(
        projectId,
        fromV,
        toV,
        selectedFile.pathname,
        abortController.signal
      )
    )
      .catch(showBoundary)
      .finally(() => {
        abortController = null
      })

    // Abort an existing request before starting a new one or on unmount
    return () => {
      if (abortController) {
        abortController.abort()
      }
    }
  }, [
    projectId,
    runAsync,
    updateRange,
    selectedFile,
    loadingFileDiffs,
    showBoundary,
  ])

  const diff = useMemo(() => {
    let diff: Diff | null

    if (!data?.diff) {
      diff = null
    } else if ('binary' in data.diff) {
      diff = { binary: true }
    } else {
      diff = {
        binary: false,
        docDiff: highlightsFromDiffResponse(data.diff, t),
      }
    }

    return diff
  }, [data, t])

  return (
    <div className="doc-panel">
      <div className="history-header toolbar-container">
        <Toolbar
          diff={diff}
          selection={selection}
          isCurrentVersion={isCurrentVersion}
        />
      </div>
      <div className="doc-container">
        <Main diff={diff} isLoading={isLoading || loadingFileDiffs} />
      </div>
    </div>
  )
}

export default DiffView
