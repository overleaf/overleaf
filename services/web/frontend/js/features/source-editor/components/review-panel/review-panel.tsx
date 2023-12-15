import ReactDOM from 'react-dom'
import EditorWidgets from './editor-widgets/editor-widgets'
import CurrentFileContainer from './current-file-container'
import OverviewContainer from './overview-container'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import {
  ReviewPanelProvider,
  useReviewPanelValueContext,
} from '../../context/review-panel/review-panel-context'
import { ReviewPanelReactIdeProvider } from '@/features/ide-react/context/review-panel/review-panel-context'
import { isCurrentFileView } from '../../utils/sub-view'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useIdeContext } from '@/shared/context/ide-context'
import classnames from 'classnames'

type ReviewPanelViewProps = {
  parentDomNode: Element
}

function ReviewPanelView({ parentDomNode }: ReviewPanelViewProps) {
  const { subView, loadingThreads, layoutToLeft } = useReviewPanelValueContext()
  const { reviewPanelOpen, miniReviewPanelVisible } = useLayoutContext()
  const { isReactIde } = useIdeContext()

  const content = (
    <>
      <EditorWidgets />
      {isCurrentFileView(subView) ? (
        <CurrentFileContainer />
      ) : (
        <OverviewContainer />
      )}
    </>
  )

  return ReactDOM.createPortal(
    isReactIde ? (
      <div
        className={classnames('review-panel-wrapper', {
          'rp-state-current-file': subView === 'cur_file',
          'rp-state-current-file-expanded':
            subView === 'cur_file' && reviewPanelOpen,
          'rp-state-current-file-mini':
            subView === 'cur_file' && !reviewPanelOpen,
          'rp-state-overview': subView === 'overview',
          'rp-size-mini': miniReviewPanelVisible,
          'rp-size-expanded': reviewPanelOpen,
          'rp-layout-left': layoutToLeft,
          'rp-loading-threads': loadingThreads,
        })}
      >
        {content}
      </div>
    ) : (
      content
    ),
    parentDomNode
  )
}

function ReviewPanel() {
  const view = useCodeMirrorViewContext()
  const { isReactIde } = useIdeContext()

  return isReactIde ? (
    <ReviewPanelReactIdeProvider>
      <ReviewPanelView parentDomNode={view.scrollDOM} />
    </ReviewPanelReactIdeProvider>
  ) : (
    <ReviewPanelProvider>
      <ReviewPanelView parentDomNode={view.scrollDOM} />
    </ReviewPanelProvider>
  )
}

export default ReviewPanel
