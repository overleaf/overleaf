import { memo, useCallback, useRef, useState } from 'react'
import { Change, CommentOperation } from '../../../../../types/change'
import { ReviewPanelMessage } from './review-panel-message'
import { useTranslation } from 'react-i18next'
import { useThreadsContext } from '../context/threads-context'
import {
  MentionsInput,
  MentionsInputHandle,
} from '@/shared/components/mentions-input'
import ReviewPanelResolvedMessage from './review-panel-resolved-message'
import { ReviewPanelResolvedCommentThread } from '../../../../../types/review-panel/comment-thread'
import {
  CommentId,
  ThreadId,
} from '../../../../../types/review-panel/review-panel'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

export const ReviewPanelCommentContent = memo<{
  comment: Change<CommentOperation>
  isResolved: boolean
  onEdit?: (commentId: CommentId, content: string) => Promise<void>
  onReply?: (content: string) => Promise<void>
  onDeleteMessage?: (commentId: CommentId) => Promise<void>
  onDeleteThread?: (threadId: ThreadId) => Promise<void>
  onResolve?: () => Promise<void>
  onLeave?: () => void
  onEnter?: () => void
}>(
  ({
    comment,
    isResolved,
    onResolve,
    onDeleteMessage,
    onDeleteThread,
    onEdit,
    onReply,
    onLeave,
    onEnter,
  }) => {
    const { t } = useTranslation()
    const threads = useThreadsContext()
    const permissions = usePermissionsContext()
    const [submitting, setSubmitting] = useState(false)
    const [content, setContent] = useState('')
    const commentInputRef = useRef<MentionsInputHandle | null>(null)

    const hasActiveContent = content.trim().length > 0

    const handleSubmit = useCallback(
      (value: string) => {
        if (!onReply || submitting) {
          return
        }

        if (value.trim().length === 0) {
          return
        }

        setSubmitting(true)

        // Clearing the editor fires its change handler, which resets `content`.
        return onReply(value)
          .then(() => {
            commentInputRef.current?.clear()
          })
          .finally(() => {
            setSubmitting(false)
          })
      },
      [onReply, submitting]
    )

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
                hasActiveContent={hasActiveContent}
                onEdit={onEdit}
                onDelete={() =>
                  isReply
                    ? onDeleteMessage?.(message.id)
                    : onDeleteThread?.(comment.op.t)
                }
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

        {permissions.comment && !isResolved && (
          <MentionsInput
            ref={commentInputRef}
            className="review-panel-add-comment-editor review-panel-comment-input"
            onChange={setContent}
            onSubmit={handleSubmit}
            placeholder={t('reply')}
            disabled={submitting}
          />
        )}
      </div>
    )
  }
)
ReviewPanelCommentContent.displayName = 'ReviewPanelCommentContent'
