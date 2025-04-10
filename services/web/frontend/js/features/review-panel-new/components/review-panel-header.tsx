import { FC, memo, useState } from 'react'
import { ReviewPanelResolvedThreadsButton } from './review-panel-resolved-threads-button'
import { ReviewPanelTrackChangesMenu } from './review-panel-track-changes-menu'
import ReviewPanelTrackChangesMenuButton from './review-panel-track-changes-menu-button'
import { useLayoutContext } from '@/shared/context/layout-context'
import { useTranslation } from 'react-i18next'
import getMeta from '@/utils/meta'
import { PanelHeading } from '@/shared/components/panel-heading'
import { useRailContext } from '@/features/ide-redesign/contexts/rail-context'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

const isReviewerRoleEnabled = getMeta('ol-isReviewerRoleEnabled')

const ReviewPanelHeader: FC = () => {
  const [trackChangesMenuExpanded, setTrackChangesMenuExpanded] =
    useState(false)
  const { setReviewPanelOpen } = useLayoutContext()
  const { setIsOpen: setRailIsOpen } = useRailContext()
  const { t } = useTranslation()

  const newEditor = useIsNewEditorEnabled()
  const handleClose = newEditor
    ? () => setRailIsOpen(false)
    : () => setReviewPanelOpen(false)

  return (
    <div className="review-panel-header">
      <PanelHeading title={t('review')} handleClose={handleClose}>
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
