import { useEffect, useState } from 'react'
import Toolbar from './toolbar/toolbar'
import Main from './main'
import { Diff, DocDiffResponse } from '../../services/types/doc'
import { Nullable } from '../../../../../../types/utils'
import { useHistoryContext } from '../../context/history-context'
import { diffDoc } from '../../services/api'
import { highlightsFromDiffResponse } from '../../utils/highlights-from-diff-response'
import useAsync from '../../../../shared/hooks/use-async'

function DiffView() {
  const [diff, setDiff] = useState<Nullable<Diff>>(null)
  const { selection, projectId } = useHistoryContext()

  const { isLoading, runAsync } = useAsync<DocDiffResponse>()

  const { updateRange, selectedFile } = selection

  useEffect(() => {
    if (!updateRange || !selectedFile?.pathname) {
      return
    }

    const { fromV, toV } = updateRange

    // TODO: Error handling
    runAsync(diffDoc(projectId, fromV, toV, selectedFile.pathname)).then(
      data => {
        let diff: Diff | undefined

        if (!data?.diff) {
          setDiff(null)
        }

        if ('binary' in data.diff) {
          diff = { binary: true }
        } else {
          diff = {
            binary: false,
            docDiff: highlightsFromDiffResponse(data.diff),
          }
        }

        setDiff(diff)
      }
    )
  }, [projectId, runAsync, updateRange, selectedFile])

  return (
    <div className="doc-panel">
      <div className="history-header toolbar-container">
        <Toolbar diff={diff} selection={selection} />
      </div>
      <div className="doc-container">
        <Main diff={diff} isLoading={isLoading} />
      </div>
    </div>
  )
}

export default DiffView
