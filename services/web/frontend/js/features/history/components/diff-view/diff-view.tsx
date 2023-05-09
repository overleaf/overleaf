import { useEffect } from 'react'
import Toolbar from './toolbar/toolbar'
import Main from './main'
import { Diff, DocDiffResponse } from '../../services/types/doc'
import { useHistoryContext } from '../../context/history-context'
import { diffDoc } from '../../services/api'
import { highlightsFromDiffResponse } from '../../utils/highlights-from-diff-response'
import useAsync from '../../../../shared/hooks/use-async'
import ErrorMessage from '../error-message'

function DiffView() {
  const { selection, projectId, loadingFileDiffs } = useHistoryContext()
  const { isLoading, data, runAsync, error } = useAsync<DocDiffResponse>()
  const { updateRange, selectedFile } = selection

  useEffect(() => {
    if (!updateRange || !selectedFile?.pathname || loadingFileDiffs) {
      return
    }

    const { fromV, toV } = updateRange

    runAsync(diffDoc(projectId, fromV, toV, selectedFile.pathname)).catch(
      console.error
    )
  }, [projectId, runAsync, updateRange, selectedFile, loadingFileDiffs])

  let diff: Diff | null

  if (!data?.diff) {
    diff = null
  } else if ('binary' in data.diff) {
    diff = { binary: true }
  } else {
    diff = {
      binary: false,
      docDiff: highlightsFromDiffResponse(data.diff),
    }
  }

  return (
    <div className="doc-panel">
      {error ? (
        <ErrorMessage />
      ) : (
        <>
          <div className="history-header toolbar-container">
            <Toolbar diff={diff} selection={selection} />
          </div>
          <div className="doc-container">
            <Main diff={diff} isLoading={isLoading || loadingFileDiffs} />
          </div>
        </>
      )}
    </div>
  )
}

export default DiffView
