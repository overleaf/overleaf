import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import {
  ReviewPanelStateProvider,
  useReviewPanelStateValueContext,
} from '../../context/review-panel-state-context'
import CurrentFileContainer from './current-file-container'
import OverviewContainer from './overview-container'

type ReviewPanelViewProps = {
  parentDomNode: Element
}

function ReviewPanelView({ parentDomNode }: ReviewPanelViewProps) {
  const { subView } = useReviewPanelStateValueContext()

  return ReactDOM.createPortal(
    <>
      {subView === 'cur_file' ? (
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
    <ReviewPanelStateProvider>
      <ReviewPanelView parentDomNode={view.scrollDOM} />
    </ReviewPanelStateProvider>
  )
}

export default ReviewPanel
