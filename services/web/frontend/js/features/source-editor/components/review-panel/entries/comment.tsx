import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import AutoExpandingTextArea from '../../../../../shared/components/auto-expanding-text-area'
import { formatTime } from '../../../../utils/format-date'
import { useReviewPanelValueContext } from '../../../context/review-panel/review-panel-context'
import {
  ReviewPanelCommentThread,
  ReviewPanelCommentThreadMessage,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'

type CommentProps = {
  thread: ReviewPanelCommentThread
  threadId: ThreadId
  comment: ReviewPanelCommentThreadMessage
}

function Comment({ thread, threadId, comment }: CommentProps) {
  const { t } = useTranslation()
  const { deleteComment, handleLayoutChange, saveEdit } =
    useReviewPanelValueContext()
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)

  const handleConfirmDelete = () => {
    setDeleting(true)
    handleLayoutChange()
  }

  const handleDoDelete = () => {
    setDeleting(false)
    deleteComment(threadId, comment.id)
    handleLayoutChange()
  }

  const handleCancelDelete = () => {
    setDeleting(false)
    handleLayoutChange()
  }

  const handleStartEditing = () => {
    setEditing(true)
    handleLayoutChange()
  }

  const handleSaveEditOnEnter = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      handleSaveEdit(e)
    }
  }

  const handleSaveEdit = (
    e:
      | React.FocusEvent<HTMLTextAreaElement>
      | React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    setEditing(false)
    saveEdit(threadId, comment.id, (e.target as HTMLTextAreaElement).value)
  }

  return (
    <div className="rp-comment">
      <p className="rp-comment-content">
        {editing ? (
          <AutoExpandingTextArea
            className="rp-comment-input"
            onKeyPress={handleSaveEditOnEnter}
            onBlur={handleSaveEdit}
            onClick={e => e.stopPropagation()}
            onResize={handleLayoutChange}
          />
        ) : (
          <>
            <span
              className="rp-entry-user"
              style={{ color: `hsl(${comment.user.hue}, 70%, 40%` }}
            >
              {comment.user.name}:
            </span>
            &nbsp;
            {comment.content}
          </>
        )}
      </p>
      {!editing && (
        <div className="rp-entry-metadata">
          {!deleting && formatTime(comment.timestamp, 'MMM d, y h:mm a')}
          {comment.user.isSelf && !deleting && (
            <span className="rp-comment-actions">
              &nbsp;&bull;&nbsp;
              <button onClick={handleStartEditing}>{t('edit')}</button>
              {thread.messages.length > 1 && (
                <>
                  &nbsp;&bull;&nbsp;
                  <button onClick={handleConfirmDelete}>{t('delete')}</button>
                </>
              )}
            </span>
          )}
          {comment.user.isSelf && deleting && (
            <span className="rp-confim-delete">
              {t('are_you_sure')}&nbsp;&bull;&nbsp;
              <button type="button" onClick={handleDoDelete}>
                {t('delete')}
              </button>
              &nbsp;&bull;&nbsp;
              <button onClick={handleCancelDelete}>{t('cancel')}</button>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default Comment
