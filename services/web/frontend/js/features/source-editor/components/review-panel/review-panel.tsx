import ReactDOM from 'react-dom'
import { useCodeMirrorViewContext } from '../codemirror-context'
import { ReviewPanelProvider } from '../../context/review-panel/review-panel-context'
import { memo } from 'react'
import ReviewPanelContent from '@/features/source-editor/components/review-panel/review-panel-content'

function ReviewPanel() {
  const view = useCodeMirrorViewContext()

  return ReactDOM.createPortal(
    <ReviewPanelProvider>
      <ReviewPanelContent />
    </ReviewPanelProvider>,
    view.scrollDOM
  )
}

export default memo(ReviewPanel)
