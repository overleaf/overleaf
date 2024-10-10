import { FC, useCallback, useState } from 'react'
import {
  CommentId,
  ReviewPanelCommentThreadMessage,
} from '../../../../../types/review-panel/review-panel'
import { useTranslation } from 'react-i18next'
import { formatTimeBasedOnYear } from '@/features/utils/format-date'
import Tooltip from '@/shared/components/tooltip'
import { Button } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import AutoExpandingTextArea from '@/shared/components/auto-expanding-text-area'
import { buildName } from '../utils/build-name'
import ReviewPanelCommentOptions from './review-panel-comment-options'
import { ExpandableContent } from './review-panel-expandable-content'
import ReviewPanelDeleteCommentModal from './review-panel-delete-comment-modal'

export const ReviewPanelMessage: FC<{
  message: ReviewPanelCommentThreadMessage
  hasReplies: boolean
  isReply: boolean
  onResolve?: () => Promise<void>
  onEdit?: (commentId: CommentId, content: string) => Promise<void>
  onDelete?: (CommentId: CommentId) => Promise<void>
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

  const handleEditOption = useCallback(() => setEditing(true), [])
  const showDeleteModal = useCallback(() => setDeleting(true), [])
  const hideDeleteModal = useCallback(() => setDeleting(false), [])

  const handleSubmit = useCallback(() => {
    onEdit?.(message.id, content)
    setEditing(false)
  }, [content, message.id, onEdit])

  const handleDelete = useCallback(() => {
    onDelete?.(message.id)
    setDeleting(false)
  }, [message.id, onDelete])

  if (editing) {
    return (
      <div>
        <AutoExpandingTextArea
          className="review-panel-comment-input"
          onBlur={handleSubmit}
          onChange={e => setContent(e.target.value)}
          onKeyDown={e => {
            if (
              e.key === 'Enter' &&
              !e.shiftKey &&
              !e.ctrlKey &&
              !e.metaKey &&
              content
            ) {
              e.preventDefault()
              handleSubmit()
            }
          }}
          value={content}
          autoFocus // eslint-disable-line jsx-a11y/no-autofocus
        />
      </div>
    )
  }

  return (
    <div className="review-panel-comment">
      <div className="review-panel-entry-header">
        <div>
          <div className="review-panel-entry-user">
            {buildName(message.user)}
          </div>
          <div className="review-panel-entry-time">
            {formatTimeBasedOnYear(message.timestamp)}
          </div>
        </div>

        <div className="review-panel-entry-actions">
          {!isReply && !isThreadResolved && (
            <Tooltip
              id="resolve-thread"
              overlayProps={{ placement: 'bottom' }}
              description={t('resolve_comment')}
              tooltipProps={{ className: 'review-panel-tooltip' }}
            >
              <Button onClick={onResolve} bsStyle={null}>
                <MaterialIcon
                  type="check"
                  className="review-panel-entry-actions-icon"
                  accessibilityLabel={t('resolve_comment')}
                />
              </Button>
            </Tooltip>
          )}

          {!isThreadResolved && (
            <ReviewPanelCommentOptions
              onEdit={handleEditOption}
              onDelete={showDeleteModal}
            />
          )}
        </div>
      </div>
      <ExpandableContent className="review-panel-comment-body">
        {message.content}
      </ExpandableContent>
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
