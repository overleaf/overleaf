import { Nullable } from '../../../../../../types/utils'
import { Diff } from '../../services/types/doc'
import DocumentDiffViewer from './document-diff-viewer'
import LoadingSpinner from '../../../../shared/components/loading-spinner'

type MainProps = {
  diff: Nullable<Diff>
  isLoading: boolean
}

function Main({ diff, isLoading }: MainProps) {
  if (isLoading) {
    return <LoadingSpinner />
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
