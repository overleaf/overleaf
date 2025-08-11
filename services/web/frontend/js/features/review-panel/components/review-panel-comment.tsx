import { memo, useCallback, useMemo, useState } from 'react'
import { Change, CommentOperation } from '../../../../../types/change'
import {
  useThreadsActionsContext,
  useThreadsContext,
} from '../context/threads-context'
import classnames from 'classnames'
import { ReviewPanelEntry } from './review-panel-entry'
import { ReviewPanelCommentContent } from './review-panel-comment-content'
import {
  CommentId,
  ThreadId,
} from '../../../../../types/review-panel/review-panel'
import { useModalsContext } from '@/features/ide-react/context/modals-context'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { useTranslation } from 'react-i18next'
import { debugConsole } from '@/utils/debugging'

export const ReviewPanelComment = memo<{
  comment: Change<CommentOperation>
  docId: string
  top?: number
  hoverRanges?: boolean
  handleEnter?: (changeId: string) => void
  handleLeave?: (changeId: string) => void
  hovered?: boolean
}>(
  ({ comment, top, hovered, handleEnter, handleLeave, docId, hoverRanges }) => {
    const threads = useThreadsContext()
    const {
      resolveThread,
      editMessage,
      deleteMessage,
      deleteOwnMessage,
      deleteThread,
      addMessage,
    } = useThreadsActionsContext()
    const { showGenericMessageModal } = useModalsContext()
    const { t } = useTranslation()
    const permissions = usePermissionsContext()

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
          if (permissions.resolveAllComments) {
            // Owners and editors can delete any message
            await deleteMessage(comment.op.t, commentId)
          } else if (permissions.resolveOwnComments) {
            // Reviewers can only delete their own messages
            await deleteOwnMessage(comment.op.t, commentId)
          }
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
      [
        comment.op.t,
        deleteMessage,
        deleteOwnMessage,
        showGenericMessageModal,
        t,
        permissions.resolveOwnComments,
        permissions.resolveAllComments,
      ]
    )

    const handleDeleteThread = useCallback(
      async (commentId: ThreadId) => {
        setProcessing(true)
        try {
          await deleteThread(commentId)
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
      [deleteThread, showGenericMessageModal, t]
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

    const { handleMouseEnter, handleMouseLeave } = useMemo(() => {
      return {
        handleMouseEnter: handleEnter && (() => handleEnter(comment.id)),
        handleMouseLeave: handleLeave && (() => handleLeave(comment.id)),
      }
    }, [comment.id, handleEnter, handleLeave])

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
        handleEnter={handleMouseEnter}
        handleLeave={handleMouseLeave}
        entryIndicator="comment"
      >
        <ReviewPanelCommentContent
          comment={comment}
          isResolved={false}
          onLeave={handleMouseLeave}
          onEnter={handleMouseEnter}
          onResolve={handleResolveComment}
          onEdit={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          onDeleteThread={handleDeleteThread}
          onReply={handleSubmitReply}
        />
      </ReviewPanelEntry>
    )
  }
)
ReviewPanelComment.displayName = 'ReviewPanelComment'
