import { FC } from 'react'
import { formatTimeBasedOnYear } from '@/features/utils/format-date'
import { buildName } from '../utils/build-name'
import { ReviewPanelResolvedCommentThread } from '../../../../../types/review-panel/comment-thread'
import { useTranslation } from 'react-i18next'

const ReviewPanelResolvedMessage: FC<{
  thread: ReviewPanelResolvedCommentThread
}> = ({ thread }) => {
  const { t } = useTranslation()

  return (
    <div className="review-panel-comment">
      <div className="review-panel-entry-header">
        <div>
          <div className="review-panel-entry-user">
            {buildName(thread.resolved_by_user)}
          </div>
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
