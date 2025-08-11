import { FC, memo } from 'react'
import { ReviewPanelResolvedThreadsButton } from './review-panel-resolved-threads-button'
import { useTranslation } from 'react-i18next'
import { PanelHeading } from '@/shared/components/panel-heading'
import useReviewPanelLayout from '../hooks/use-review-panel-layout'

const ReviewPanelHeader: FC = () => {
  const { closeReviewPanel } = useReviewPanelLayout()
  const { t } = useTranslation()

  return (
    <div className="review-panel-header">
      <PanelHeading title={t('review')} handleClose={closeReviewPanel}>
        <ReviewPanelResolvedThreadsButton />
      </PanelHeading>
    </div>
  )
}

export default memo(ReviewPanelHeader)
