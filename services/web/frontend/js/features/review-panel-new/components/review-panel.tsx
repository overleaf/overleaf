import { FC, memo, useMemo } from 'react'
import ReviewPanelTabs from './review-panel-tabs'
import ReviewPanelHeader from './review-panel-header'
import ReviewPanelCurrentFile from './review-panel-current-file'
import { ReviewPanelOverview } from './review-panel-overview'
import classnames from 'classnames'
import { useReviewPanelStyles } from '@/features/review-panel-new/hooks/use-review-panel-styles'
import { useReviewPanelViewContext } from '../context/review-panel-view-context'

const ReviewPanel: FC<{ mini?: boolean }> = ({ mini = false }) => {
  const choosenSubView = useReviewPanelViewContext()

  const activeSubView = useMemo(
    () => (mini ? 'cur_file' : choosenSubView),
    [choosenSubView, mini]
  )

  const style = useReviewPanelStyles(mini)

  const className = classnames('review-panel-new', 'review-panel-container', {
    'review-panel-mini': mini,
    'review-panel-subview-overview': activeSubView === 'overview',
  })

  return (
    <div className={className} style={style}>
      <div id="review-panel-inner" className="review-panel-inner">
        {!mini && <ReviewPanelHeader />}

        {activeSubView === 'cur_file' && <ReviewPanelCurrentFile />}
        {activeSubView === 'overview' && <ReviewPanelOverview />}

        <div className="review-panel-footer">
          <ReviewPanelTabs />
        </div>
      </div>
    </div>
  )
}

export default memo(ReviewPanel)
