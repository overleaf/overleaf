import ReactDOM from 'react-dom'
import EditorWidgets from './editor-widgets/editor-widgets'
import CurrentFileContainer from './current-file-container'
import OverviewContainer from './overview-container'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import { useReviewPanelValueContext } from '../../context/review-panel/review-panel-context'
import { isCurrentFileView } from '../../utils/sub-view'
import { useLayoutContext } from '@/shared/context/layout-context'
import classnames from 'classnames'
import { lazy, memo } from 'react'
import getMeta from '@/utils/meta'
import { SubView } from '../../../../../../types/review-panel/review-panel'

const isReactIde: boolean = getMeta('ol-idePageReact')

type ReviewPanelViewProps = {
  parentDomNode: Element
}

function ReviewPanelView({ parentDomNode }: ReviewPanelViewProps) {
  const { subView } = useReviewPanelValueContext()

  return ReactDOM.createPortal(
    isReactIde ? (
      <ReviewPanelContainer />
    ) : (
      <ReviewPanelContent subView={subView} />
    ),
    parentDomNode
  )
}

const ReviewPanelContainer = memo(() => {
  const { subView, loadingThreads, layoutToLeft } = useReviewPanelValueContext()
  const { reviewPanelOpen, miniReviewPanelVisible } = useLayoutContext()

  const className = classnames('review-panel-wrapper', {
    'rp-state-current-file': subView === 'cur_file',
    'rp-state-current-file-expanded': subView === 'cur_file' && reviewPanelOpen,
    'rp-state-current-file-mini': subView === 'cur_file' && !reviewPanelOpen,
    'rp-state-overview': subView === 'overview',
    'rp-size-mini': miniReviewPanelVisible,
    'rp-size-expanded': reviewPanelOpen,
    'rp-layout-left': layoutToLeft,
    'rp-loading-threads': loadingThreads,
  })

  return (
    <div className={className}>
      <ReviewPanelContent subView={subView} />
    </div>
  )
})
ReviewPanelContainer.displayName = 'ReviewPanelContainer'

const ReviewPanelContent = memo<{ subView: SubView }>(({ subView }) => (
  <>
    <EditorWidgets />
    {isCurrentFileView(subView) ? (
      <CurrentFileContainer />
    ) : (
      <OverviewContainer />
    )}
  </>
))
ReviewPanelContent.displayName = 'ReviewPanelContent'

const ReviewPanelProvider = lazy(() =>
  isReactIde
    ? import('@/features/ide-react/context/review-panel/review-panel-provider')
    : import('../../context/review-panel/review-panel-provider')
)

function ReviewPanel() {
  const view = useCodeMirrorViewContext()

  return (
    <ReviewPanelProvider>
      <ReviewPanelView parentDomNode={view.scrollDOM} />
    </ReviewPanelProvider>
  )
}

export default memo(ReviewPanel)
