import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import EntryContainer from './entry-container'
import EntryCallout from './entry-callout'
import EntryActions from './entry-actions'
import AutoExpandingTextArea from '../../../../../shared/components/auto-expanding-text-area'
import Icon from '../../../../../shared/components/icon'
import { useReviewPanelValueContext } from '../../../context/review-panel/review-panel-context'
import classnames from 'classnames'
import { ReviewPanelAddCommentEntry } from '../../../../../../../types/review-panel/entry'

type AddCommentEntryProps = {
  entry: ReviewPanelAddCommentEntry
}

function AddCommentEntry({ entry }: AddCommentEntryProps) {
  const { t } = useTranslation()
  const { submitNewComment, handleLayoutChange } = useReviewPanelValueContext()

  const [content, setContent] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleStartNewComment = () => {
    setIsAdding(true)
    handleLayoutChange()
  }

  const handleSubmitNewComment = () => {
    submitNewComment(content)
    setIsAdding(false)
    setContent('')
  }

  const handleCancelNewComment = () => {
    setIsAdding(false)
    setContent('')
    handleLayoutChange()
  }

  const handleCommentKeyPress = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    const target = e.target as HTMLTextAreaElement

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()
      if (content.length) {
        handleSubmitNewComment()
      }
    }

    if (['PageDown', 'PageUp'].includes(e.key)) {
      if (target.closest('textarea')) {
        e.preventDefault()
      }
    }
  }

  return (
    <EntryContainer>
      <EntryCallout className="rp-entry-callout-add-comment" />
      <div
        className={classnames('rp-entry', 'rp-entry-add-comment', {
          'rp-entry-adding-comment': isAdding,
        })}
        style={{
          top: entry.screenPos.y + 'px',
          visibility: entry.visible ? 'visible' : 'hidden',
        }}
      >
        {isAdding ? (
          <>
            <div className="rp-new-comment">
              <AutoExpandingTextArea
                className="rp-comment-input"
                onChange={e => setContent(e.target.value)}
                onKeyPress={handleCommentKeyPress}
                onResize={handleLayoutChange}
                placeholder={t('add_your_comment_here')}
                value={content}
                autoFocus // eslint-disable-line jsx-a11y/no-autofocus
              />
            </div>
            <EntryActions>
              <EntryActions.Button
                className="rp-entry-button-cancel"
                onClick={handleCancelNewComment}
              >
                <Icon type="times" /> {t('cancel')}
              </EntryActions.Button>
              <EntryActions.Button
                onClick={handleSubmitNewComment}
                disabled={!content.length}
              >
                <Icon type="comment" /> {t('comment')}
              </EntryActions.Button>
            </EntryActions>
          </>
        ) : (
          <button
            className="rp-add-comment-btn"
            onClick={handleStartNewComment}
          >
            <Icon type="comment" /> {t('add_comment')}
          </button>
        )}
      </div>
    </EntryContainer>
  )
}

export default AddCommentEntry
