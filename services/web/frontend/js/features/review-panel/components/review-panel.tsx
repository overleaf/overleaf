import { FC, memo, useMemo } from 'react'
import ReviewPanelTabs from './review-panel-tabs'
import ReviewPanelHeader from './review-panel-header'
import ReviewPanelCurrentFile from './review-panel-current-file'
import { ReviewPanelOverview } from './review-panel-overview'
import classnames from 'classnames'
import { useReviewPanelStyles } from '@/features/review-panel/hooks/use-review-panel-styles'
import { useReviewPanelViewContext } from '../context/review-panel-view-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

const ReviewPanel: FC<{ mini?: boolean }> = ({ mini = false }) => {
  const choosenSubView = useReviewPanelViewContext()
  const newEditor = useIsNewEditorEnabled()

  const activeSubView = useMemo(
    () => (mini ? 'cur_file' : choosenSubView),
    [choosenSubView, mini]
  )

  const style = useReviewPanelStyles()

  const className = classnames('review-panel-container', {
    'review-panel-mini': mini,
    'review-panel-subview-overview': activeSubView === 'overview',
  })

  return (
    <div className={className} style={style} data-testid="review-panel">
      <div id="review-panel-inner" className="review-panel-inner">
        {!newEditor && !mini && <ReviewPanelHeader />}

        {activeSubView === 'cur_file' && <ReviewPanelCurrentFile />}
        {activeSubView === 'overview' && <ReviewPanelOverview />}

        <div
          className="review-panel-footer"
          id="review-panel-tabs"
          role="tablist"
        >
          <ReviewPanelTabs />
        </div>
      </div>
    </div>
  )
}

export default memo(ReviewPanel)
