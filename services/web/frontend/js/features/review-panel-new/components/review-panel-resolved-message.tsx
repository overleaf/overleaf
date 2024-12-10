import { FC } from 'react'
import { formatTimeBasedOnYear } from '@/features/utils/format-date'
import { ReviewPanelResolvedCommentThread } from '../../../../../types/review-panel/comment-thread'
import { useTranslation } from 'react-i18next'
import ReviewPanelEntryUser from './review-panel-entry-user'

const ReviewPanelResolvedMessage: FC<{
  thread: ReviewPanelResolvedCommentThread
}> = ({ thread }) => {
  const { t } = useTranslation()

  return (
    <div className="review-panel-comment">
      <div className="review-panel-entry-header">
        <div>
          <ReviewPanelEntryUser user={thread.resolved_by_user} />
          <div className="review-panel-entry-time">
            {formatTimeBasedOnYear(thread.resolved_at)}
          </div>
        </div>
      </div>
      <div className="review-panel-comment-body review-panel-resolved-message">
        <i>{t('marked_as_resolved')}</i>
      </div>
    </div>
  )
}

export default ReviewPanelResolvedMessage
