import { memo, useCallback } from 'react'
import { Change, CommentOperation } from '../../../../../types/change'
import { ReviewPanelMessage } from './review-panel-message'
import { useTranslation } from 'react-i18next'
import { useThreadsContext } from '../context/threads-context'
import AutoExpandingTextArea from '@/shared/components/auto-expanding-text-area'
import ReviewPanelResolvedMessage from './review-panel-resolved-message'
import { ReviewPanelResolvedCommentThread } from '../../../../../types/review-panel/comment-thread'
import useSubmittableTextInput from '../hooks/use-submittable-text-input'
import { CommentId } from '../../../../../types/review-panel/review-panel'

export const ReviewPanelCommentContent = memo<{
  comment: Change<CommentOperation>
  isResolved: boolean
  onEdit?: (commentId: CommentId, content: string) => Promise<void>
  onReply?: (content: string) => Promise<void>
  onDelete?: (commentId: CommentId) => Promise<void>
  onResolve?: () => Promise<void>
  onLeave?: () => void
  onEnter?: () => void
}>(
  ({
    comment,
    isResolved,
    onResolve,
    onDelete,
    onEdit,
    onReply,
    onLeave,
    onEnter,
  }) => {
    const { t } = useTranslation()
    const threads = useThreadsContext()

    const handleSubmit = useCallback(
      (content, setContent) => onReply?.(content).then(() => setContent('')),
      [onReply]
    )

    const { handleChange, handleKeyPress, content } =
      useSubmittableTextInput(handleSubmit)

    const thread = threads?.[comment.op.t]
    if (!thread) {
      return null
    }

    return (
      <div
        className="review-panel-entry-content"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {thread.messages.map((message, i) => {
          const isReply = i !== 0

          return (
            <div key={message.id} className="review-panel-comment-wrapper">
              {isReply && (
                <div className="review-panel-comment-reply-divider" />
              )}
              <ReviewPanelMessage
                message={message}
                isReply={isReply}
                hasReplies={!isReply && thread.messages.length > 1}
                onResolve={onResolve}
                onEdit={onEdit}
                onDelete={onDelete}
                isThreadResolved={isResolved}
              />
            </div>
          )
        })}

        {isResolved && (
          <div className="review-panel-comment-wrapper">
            <div className="review-panel-comment-reply-divider" />
            <ReviewPanelResolvedMessage
              thread={thread as ReviewPanelResolvedCommentThread}
            />
          </div>
        )}

        {!isResolved && (
          <AutoExpandingTextArea
            name="content"
            className="review-panel-comment-input"
            onChange={handleChange}
            onKeyDown={handleKeyPress}
            placeholder={t('reply')}
            value={content}
          />
        )}
      </div>
    )
  }
)
ReviewPanelCommentContent.displayName = 'ReviewPanelCommentContent'
