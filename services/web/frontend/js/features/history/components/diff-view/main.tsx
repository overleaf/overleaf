import { useHistoryContext } from '../../context/history-context'
import { diffDoc } from '../../services/api'
import { useEffect } from 'react'
import { DocDiffResponse, Highlight } from '../../services/types/doc'
import { highlightsFromDiffResponse } from '../../utils/highlights-from-diff-response'
import DocumentDiffViewer from './document-diff-viewer'
import useAsync from '../../../../shared/hooks/use-async'
import { useTranslation } from 'react-i18next'

type Diff = {
  binary: boolean
  docDiff?: {
    doc: string
    highlights: Highlight[]
  }
}

function Main() {
  const { t } = useTranslation()
  const { projectId, updateSelection, fileSelection } = useHistoryContext()
  const { isLoading, runAsync, data } = useAsync<DocDiffResponse>()
  let diff: Diff | undefined
  if (data?.diff) {
    if ('binary' in data.diff) {
      diff = { binary: true }
    } else {
      diff = { binary: false, docDiff: highlightsFromDiffResponse(data.diff) }
    }
  }

  useEffect(() => {
    if (!updateSelection || !fileSelection || !fileSelection.pathname) {
      return
    }

    const { fromV, toV } = updateSelection.update

    // TODO: Error handling
    runAsync(diffDoc(projectId, fromV, toV, fileSelection.pathname))
  }, [fileSelection, projectId, runAsync, updateSelection])

  if (isLoading) {
    return (
      <div className="history-loading-panel">
        <i className="fa fa-spin fa-refresh" />
        &nbsp;&nbsp;
        {t('loading')}…
      </div>
    )
  }

  if (!diff) {
    return <div>No document</div>
  }

  if (diff.binary) {
    return <div>Binary file</div>
  }

  if (diff.docDiff) {
    const { doc, highlights } = diff.docDiff
    return <DocumentDiffViewer doc={doc} highlights={highlights} />
  }

  return <div>No document</div>
}

export default Main
