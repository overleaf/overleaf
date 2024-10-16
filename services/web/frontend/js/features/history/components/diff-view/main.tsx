import { Nullable } from '../../../../../../types/utils'
import { Diff } from '../../services/types/doc'
import DocumentDiffViewer from './document-diff-viewer'
import LoadingSpinner from '../../../../shared/components/loading-spinner'
import { useTranslation } from 'react-i18next'
import OLNotification from '@/features/ui/components/ol/ol-notification'

type MainProps = {
  diff: Nullable<Diff>
  isLoading: boolean
}

function Main({ diff, isLoading }: MainProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return <LoadingSpinner />
  }

  if (!diff) {
    return <div className="history-content">No document</div>
  }

  if (diff.binary) {
    return (
      <div className="history-content">
        <OLNotification content={t('binary_history_error')} type="info" />
      </div>
    )
  }

  if (diff.docDiff) {
    const { doc, highlights } = diff.docDiff
    return <DocumentDiffViewer doc={doc} highlights={highlights} />
  }

  return null
}

export default Main
