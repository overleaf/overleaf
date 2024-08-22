import { FC, memo, useState } from 'react'
import ReviewPanelTabs from './review-panel-tabs'
import ReviewPanelHeader from './review-panel-header'
import ReviewPanelCurrentFile from './review-panel-current-file'
import { ReviewPanelOverview } from './review-panel-overview'
import classnames from 'classnames'
import { useReviewPanelStyles } from '@/features/review-panel-new/hooks/use-review-panel-styles'

export type SubView = 'cur_file' | 'overview'

const ReviewPanel: FC<{ mini?: boolean }> = ({ mini = false }) => {
  const [subView, setSubView] = useState<SubView>('cur_file')

  const style = useReviewPanelStyles(mini)

  const className = classnames('review-panel-new', 'review-panel-container', {
    'review-panel-mini': mini,
    'review-panel-subview-overview': subView === 'overview',
  })

  return (
    <div className={className} style={style}>
      <div className="review-panel-inner">
        {!mini && <ReviewPanelHeader />}

        {subView === 'cur_file' && <ReviewPanelCurrentFile />}
        {subView === 'overview' && <ReviewPanelOverview />}

        <div className="review-panel-footer">
          <ReviewPanelTabs subView={subView} setSubView={setSubView} />
        </div>
      </div>
    </div>
  )
}

export default memo(ReviewPanel)
