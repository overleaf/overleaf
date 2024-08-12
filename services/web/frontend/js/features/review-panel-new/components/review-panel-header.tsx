import { FC, memo, useState } from 'react'
import { ReviewPanelResolvedThreads } from './review-panel-resolved-threads'
import { ReviewPanelTrackChangesMenu } from './review-panel-track-changes-menu'
import ReviewPanelTrackChangesMenuButton from './review-panel-track-changes-menu-button'
import { Button } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import { useLayoutContext } from '@/shared/context/layout-context'

const ReviewPanelHeader: FC<{
  top: number
  width: number
}> = ({ top, width }) => {
  const [trackChangesMenuExpanded, setTrackChangesMenuExpanded] =
    useState(false)
  const { setReviewPanelOpen } = useLayoutContext()

  return (
    <div className="review-panel-header" style={{ top, width }}>
      <div className="review-panel-heading">
        <div className="review-panel-label">Review</div>
        <Button
          bsStyle={null}
          className="review-panel-close-button"
          type="button"
          onClick={() => setReviewPanelOpen(false)}
        >
          <MaterialIcon type="close" />
        </Button>
      </div>
      <div className="review-panel-tools">
        <ReviewPanelResolvedThreads />
        <ReviewPanelTrackChangesMenuButton
          menuExpanded={trackChangesMenuExpanded}
          setMenuExpanded={setTrackChangesMenuExpanded}
        />
      </div>

      {trackChangesMenuExpanded && <ReviewPanelTrackChangesMenu />}
    </div>
  )
}

export default memo(ReviewPanelHeader)
