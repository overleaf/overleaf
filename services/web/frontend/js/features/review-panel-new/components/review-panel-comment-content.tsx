import { memo, useCallback, useState } from 'react'
import { Change, CommentOperation } from '../../../../../types/change'
import { ReviewPanelMessage } from './review-panel-message'
import { useTranslation } from 'react-i18next'
import {
  useThreadsActionsContext,
  useThreadsContext,
} from '../context/threads-context'
import AutoExpandingTextArea from '@/shared/components/auto-expanding-text-area'
import ReviewPanelResolvedMessage from './review-panel-resolved-message'
import { ReviewPanelResolvedCommentThread } from '../../../../../types/review-panel/comment-thread'

export const ReviewPanelCommentContent = memo<{
  comment: Change<CommentOperation>
  isResolved: boolean
}>(({ comment, isResolved }) => {
  const { t } = useTranslation()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<Error>()
  const [content, setContent] = useState('')
  const threads = useThreadsContext()
  const { resolveThread, addMessage } = useThreadsActionsContext()

  const handleSubmitReply = useCallback(() => {
    setSubmitting(true)
    addMessage(comment.op.t, content)
      .then(() => {
        setContent('')
      })
      .catch(error => {
        setError(error)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }, [addMessage, comment.op.t, content])

  const handleCommentReplyKeyPress = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      handleSubmitReply()
    }
  }

  const thread = threads?.[comment.op.t]
  if (!thread) {
    return null
  }

  return (
    <div className="review-panel-entry-content">
      {thread.messages.map((message, i) => {
        const isReply = i !== 0

        return (
          <div key={message.id} className="review-panel-comment-wrapper">
            {isReply && <div className="review-panel-comment-reply-divider" />}
            <ReviewPanelMessage
              message={message}
              threadId={comment.op.t}
              isReply={isReply}
              hasReplies={!isReply && thread.messages.length > 1}
              onResolve={() => resolveThread(comment.op.t)}
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
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleCommentReplyKeyPress}
          placeholder={t('reply')}
          value={content}
          disabled={submitting}
        />
      )}

      {error && <div>{error.message}</div>}
    </div>
  )
})
ReviewPanelCommentContent.displayName = 'ReviewPanelCommentContent'
