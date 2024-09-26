import { FC, memo, useMemo, useState } from 'react'
import ReviewPanelTabs from './review-panel-tabs'
import ReviewPanelHeader from './review-panel-header'
import ReviewPanelCurrentFile from './review-panel-current-file'
import { ReviewPanelOverview } from './review-panel-overview'
import classnames from 'classnames'
import { useReviewPanelStyles } from '@/features/review-panel-new/hooks/use-review-panel-styles'

export type SubView = 'cur_file' | 'overview'

const ReviewPanel: FC<{ mini?: boolean }> = ({ mini = false }) => {
  const [choosenSubView, setSubView] = useState<SubView>('cur_file')
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
      <div className="review-panel-inner">
        {!mini && <ReviewPanelHeader />}

        {activeSubView === 'cur_file' && <ReviewPanelCurrentFile />}
        {activeSubView === 'overview' && <ReviewPanelOverview />}

        <div className="review-panel-footer">
          <ReviewPanelTabs subView={activeSubView} setSubView={setSubView} />
        </div>
      </div>
    </div>
  )
}

export default memo(ReviewPanel)
