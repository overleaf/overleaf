import { FC, memo, useState } from 'react'
import { ReviewPanelResolvedThreadsButton } from './review-panel-resolved-threads-button'
import { ReviewPanelTrackChangesMenu } from './review-panel-track-changes-menu'
import ReviewPanelTrackChangesMenuButton from './review-panel-track-changes-menu-button'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import { PanelHeading } from '@/shared/components/panel-heading'

const isReviewerRoleEnabled = getMeta('ol-isReviewerRoleEnabled')

const ReviewPanelHeader: FC = () => {
  const [trackChangesMenuExpanded, setTrackChangesMenuExpanded] =
    useState(false)
  const { setReviewPanelOpen } = useLayoutContext()
  const { t } = useTranslation()

  return (
    <div className="review-panel-header">
      <PanelHeading
        title={t('review')}
        handleClose={() => setReviewPanelOpen(false)}
        splitTestName="review-panel-redesign"
      >
        {isReviewerRoleEnabled && <ReviewPanelResolvedThreadsButton />}
      </PanelHeading>
      {!isReviewerRoleEnabled && (
        <div className="review-panel-tools">
          <ReviewPanelResolvedThreadsButton />
          <ReviewPanelTrackChangesMenuButton
            menuExpanded={trackChangesMenuExpanded}
            setMenuExpanded={setTrackChangesMenuExpanded}
          />
        </div>
      )}

      {trackChangesMenuExpanded && <ReviewPanelTrackChangesMenu />}
    </div>
  )
}

export default memo(ReviewPanelHeader)
