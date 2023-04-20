import { Nullable } from '../../../../../../types/utils'
import { Diff } from '../../services/types/doc'
import DocumentDiffViewer from './document-diff-viewer'
import { useTranslation } from 'react-i18next'

type MainProps = {
  diff: Nullable<Diff>
  isLoading: boolean
}

function Main({ diff, isLoading }: MainProps) {
  const { t } = useTranslation()

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
