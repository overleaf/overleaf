import { FC, useCallback, useState } from 'react'
import {
  CommentId,
  ReviewPanelCommentThreadMessage,
} from '../../../../../types/review-panel/review-panel'
import { useTranslation } from 'react-i18next'
import { FormatTimeBasedOnYear } from '@/shared/components/format-time-based-on-year'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import AutoExpandingTextArea from '@/shared/components/auto-expanding-text-area'
import ReviewPanelCommentOptions from './review-panel-comment-options'
import { ExpandableContent } from './review-panel-expandable-content'
import ReviewPanelDeleteCommentModal from './review-panel-delete-comment-modal'
import { useUserContext } from '@/shared/context/user-context'
import ReviewPanelEntryUser from './review-panel-entry-user'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

export const ReviewPanelMessage: FC<{
  message: ReviewPanelCommentThreadMessage
  hasReplies: boolean
  isReply: boolean
  onResolve?: () => Promise<void>
  onEdit?: (commentId: CommentId, content: string) => Promise<void>
  onDelete?: () => void
  isThreadResolved: boolean
}> = ({
  message,
  isReply,
  hasReplies,
  onResolve,
  onEdit,
  onDelete,
  isThreadResolved,
}) => {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [content, setContent] = useState(message.content)
  const user = useUserContext()
  const permissions = usePermissionsContext()

  const isCommentAuthor = user.id === message.user.id
  const canEdit = isCommentAuthor
  const canResolve =
    permissions.resolveAllComments ||
    (permissions.resolveOwnComments && isCommentAuthor)
  const canDelete = canResolve

  const handleEditOption = useCallback(() => setEditing(true), [])
  const showDeleteModal = useCallback(() => setDeleting(true), [])
  const hideDeleteModal = useCallback(() => setDeleting(false), [])

  const handleSubmit = useCallback(() => {
    onEdit?.(message.id, content)
    setEditing(false)
  }, [content, message.id, onEdit])

  const handleDelete = useCallback(() => {
    onDelete?.()
    setDeleting(false)
  }, [onDelete])

  return (
    <div className="review-panel-comment">
      <div className="review-panel-entry-header">
        <div>
          <ReviewPanelEntryUser user={message.user} />
          <div className="review-panel-entry-time">
            <FormatTimeBasedOnYear date={message.timestamp} />
          </div>
        </div>

        <div className="review-panel-entry-actions">
          {!editing && !isReply && !isThreadResolved && canResolve && (
            <OLTooltip
              id="resolve-thread"
              overlayProps={{ placement: 'bottom' }}
              description={t('resolve_comment')}
              tooltipProps={{ className: 'review-panel-tooltip' }}
            >
              <button
                type="button"
                tabIndex={0}
                className="btn"
                onClick={onResolve}
              >
                <MaterialIcon
                  type="check"
                  className="review-panel-entry-actions-icon"
                  accessibilityLabel={t('resolve_comment')}
                />
              </button>
            </OLTooltip>
          )}

          {!editing && !isThreadResolved && (
            <ReviewPanelCommentOptions
              canDelete={canDelete}
              canEdit={canEdit}
              onEdit={handleEditOption}
              onDelete={showDeleteModal}
              id={message.id}
            />
          )}
        </div>
      </div>
      {editing ? (
        <AutoExpandingTextArea
          className="review-panel-comment-input review-panel-comment-edit"
          onBlur={handleSubmit}
          onChange={e => setContent(e.target.value)}
          onKeyPress={e => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.ctrlKey &&
              !e.metaKey &&
              content
            ) {
              e.preventDefault()
              ;(e.target as HTMLTextAreaElement).blur()
            }
          }}
          value={content}
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
        />
      ) : (
        <ExpandableContent
          className="review-panel-comment-body"
          contentLimit={100}
          checkNewLines
          content={message.content}
        />
      )}

      {deleting && (
        <ReviewPanelDeleteCommentModal
          onHide={hideDeleteModal}
          onDelete={handleDelete}
          title={hasReplies ? t('delete_comment_thread') : t('delete_comment')}
          message={
            hasReplies
              ? t('delete_comment_thread_message')
              : t('delete_comment_message')
          }
        />
      )}
    </div>
  )
}
