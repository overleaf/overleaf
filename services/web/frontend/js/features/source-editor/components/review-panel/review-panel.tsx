import ReactDOM from 'react-dom'
import EditorWidgets from './editor-widgets/editor-widgets'
import CurrentFileContainer from './current-file-container'
import OverviewContainer from './overview-container'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import {
  ReviewPanelProvider,
  useReviewPanelValueContext,
} from '../../context/review-panel/review-panel-context'
import { isCurrentFileView } from '../../utils/sub-view'

type ReviewPanelViewProps = {
  parentDomNode: Element
}

function ReviewPanelView({ parentDomNode }: ReviewPanelViewProps) {
  const { subView } = useReviewPanelValueContext()

  return ReactDOM.createPortal(
    <>
      <EditorWidgets />
      {isCurrentFileView(subView) ? (
        <CurrentFileContainer />
      ) : (
        <OverviewContainer />
      )}
    </>,
    parentDomNode
  )
}

function ReviewPanel() {
  const view = useCodeMirrorViewContext()

  return (
    <ReviewPanelProvider>
      <ReviewPanelView parentDomNode={view.scrollDOM} />
    </ReviewPanelProvider>
  )
}

export default ReviewPanel
