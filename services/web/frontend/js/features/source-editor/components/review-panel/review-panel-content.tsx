import { FC, memo } from 'react'
import EditorWidgets from '@/features/source-editor/components/review-panel/editor-widgets/editor-widgets'
import { isCurrentFileView } from '@/features/source-editor/utils/sub-view'
import CurrentFileContainer from '@/features/source-editor/components/review-panel/current-file-container'
import OverviewContainer from '@/features/source-editor/components/review-panel/overview-container'
import { useReviewPanelValueContext } from '@/features/source-editor/context/review-panel/review-panel-context'
import { useLayoutContext } from '@/shared/context/layout-context'
import classnames from 'classnames'

const ReviewPanelContent: FC = () => {
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
      <EditorWidgets />
      {isCurrentFileView(subView) ? (
        <CurrentFileContainer />
      ) : (
        <OverviewContainer />
      )}
    </div>
  )
}

export default memo(ReviewPanelContent)
