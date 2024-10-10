import { memo, useCallback, useState } from 'react'
import { Change, CommentOperation } from '../../../../../types/change'
import {
  useThreadsActionsContext,
  useThreadsContext,
} from '../context/threads-context'
import classnames from 'classnames'
import { ReviewPanelEntry } from './review-panel-entry'
import MaterialIcon from '@/shared/components/material-icon'
import { ReviewPanelCommentContent } from './review-panel-comment-content'
import { CommentId } from '../../../../../types/review-panel/review-panel'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { useTranslation } from 'react-i18next'
import { debugConsole } from '@/utils/debugging'

export const ReviewPanelComment = memo<{
  comment: Change<CommentOperation>
  docId: string
  top?: number
  hoverRanges?: boolean
  onEnter?: () => void
  onLeave?: () => void
  hovered?: boolean
}>(({ comment, top, hovered, onEnter, onLeave, docId, hoverRanges }) => {
  const threads = useThreadsContext()
  const { resolveThread, editMessage, deleteMessage, addMessage } =
    useThreadsActionsContext()
  const { showGenericMessageModal } = useModalsContext()
  const { t } = useTranslation()

  const [processing, setProcessing] = useState(false)

  const handleResolveComment = useCallback(async () => {
    setProcessing(true)
    try {
      await resolveThread(comment.op.t)
    } catch (err) {
      debugConsole.error(err)
      showGenericMessageModal(
        t('resolve_comment_error_title'),
        t('resolve_comment_error_message')
      )
    } finally {
      setProcessing(false)
    }
  }, [comment.op.t, resolveThread, showGenericMessageModal, t])

  const handleEditMessage = useCallback(
    async (commentId: CommentId, content: string) => {
      setProcessing(true)
      try {
        await editMessage(comment.op.t, commentId, content)
      } catch (err) {
        debugConsole.error(err)
        showGenericMessageModal(
          t('edit_comment_error_title'),
          t('edit_comment_error_message')
        )
      } finally {
        setProcessing(false)
      }
    },
    [comment.op.t, editMessage, showGenericMessageModal, t]
  )

  const handleDeleteMessage = useCallback(
    async (commentId: CommentId) => {
      setProcessing(true)
      try {
        await deleteMessage(comment.op.t, commentId)
      } catch (err) {
        debugConsole.error(err)
        showGenericMessageModal(
          t('delete_comment_error_title'),
          t('delete_comment_error_message')
        )
      } finally {
        setProcessing(false)
      }
    },
    [comment.op.t, deleteMessage, showGenericMessageModal, t]
  )

  const handleSubmitReply = useCallback(
    async (content: string) => {
      setProcessing(true)
      try {
        await addMessage(comment.op.t, content)
      } catch (err) {
        debugConsole.error(err)
        showGenericMessageModal(
          t('add_comment_error_title'),
          t('add_comment_error_message')
        )
        throw err
      } finally {
        setProcessing(false)
      }
    },
    [addMessage, comment.op.t, showGenericMessageModal, t]
  )

  const thread = threads?.[comment.op.t]
  if (!thread || thread.resolved || thread.messages.length === 0) {
    return null
  }

  return (
    <ReviewPanelEntry
      className={classnames('review-panel-entry-comment', {
        'review-panel-entry-loaded': !!threads?.[comment.op.t],
        'review-panel-entry-hover': hovered,
      })}
      docId={docId}
      top={top}
      op={comment.op}
      position={comment.op.p}
      hoverRanges={hoverRanges}
      disabled={processing}
    >
      <div
        className="review-panel-entry-indicator"
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <MaterialIcon type="comment" className="review-panel-entry-icon" />
      </div>
      <ReviewPanelCommentContent
        comment={comment}
        isResolved={false}
        onLeave={onLeave}
        onEnter={onEnter}
        onResolve={handleResolveComment}
        onEdit={handleEditMessage}
        onDelete={handleDeleteMessage}
        onReply={handleSubmitReply}
      />
    </ReviewPanelEntry>
  )
})
ReviewPanelComment.displayName = 'ReviewPanelComment'
