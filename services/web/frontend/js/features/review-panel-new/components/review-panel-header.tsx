import { FC, memo, useState } from 'react'
import { ReviewPanelResolvedThreadsButton } from './review-panel-resolved-threads-button'
import { ReviewPanelTrackChangesMenu } from './review-panel-track-changes-menu'
import ReviewPanelTrackChangesMenuButton from './review-panel-track-changes-menu-button'
import { Button } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import { useLayoutContext } from '@/shared/context/layout-context'
import SplitTestBadge from '@/shared/components/split-test-badge'
import { useTranslation } from 'react-i18next'

const ReviewPanelHeader: FC = () => {
  const [trackChangesMenuExpanded, setTrackChangesMenuExpanded] =
    useState(false)
  const { setReviewPanelOpen } = useLayoutContext()
  const { t } = useTranslation()

  return (
    <div className="review-panel-header">
      <div className="review-panel-heading">
        <div className="review-panel-label">
          {t('review')}
          <span className="review-panel-split-test-badge">
            <SplitTestBadge
              splitTestName="review-panel-redesign"
              displayOnVariants={['enabled']}
            />
          </span>
        </div>
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
        <ReviewPanelResolvedThreadsButton />
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
