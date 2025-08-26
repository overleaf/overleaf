import { FC, memo } from 'react'
import { ReviewPanelResolvedThreadsButton } from './review-panel-resolved-threads-button'
import { useTranslation } from 'react-i18next'
import { PanelHeading } from '@/shared/components/panel-heading'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'
import RailPanelHeader from '@/features/ide-redesign/components/rail/rail-panel-header'
import { useIsNewEditorEnabled } from '@/features/ide-redesign/utils/new-editor-utils'

const ReviewPanelHeader: FC = () => {
  const { closeReviewPanel } = useReviewPanelLayout()
  const { t } = useTranslation()
  const newEditor = useIsNewEditorEnabled()

  return (
    <div className="review-panel-header">
      {newEditor ? (
        <RailPanelHeader
          title={t('review')}
          actions={[<ReviewPanelResolvedThreadsButton key="resolve-threads" />]}
        />
      ) : (
        <PanelHeading title={t('review')} handleClose={closeReviewPanel}>
          <ReviewPanelResolvedThreadsButton />
        </PanelHeading>
      )}
    </div>
  )
}

export default memo(ReviewPanelHeader)
