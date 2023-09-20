import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import EntryContainer from './entry-container'
import EntryCallout from './entry-callout'
import EntryActions from './entry-actions'
import AutoExpandingTextArea from '../../../../../shared/components/auto-expanding-text-area'
import AddCommentButton from '../add-comment-button'
import Icon from '../../../../../shared/components/icon'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../../context/review-panel/review-panel-context'
import classnames from 'classnames'
import { ReviewPanelAddCommentEntry } from '../../../../../../../types/review-panel/entry'

type AddCommentEntryProps = {
  entryId: ReviewPanelAddCommentEntry['type']
}

function AddCommentEntry({ entryId }: AddCommentEntryProps) {
  const { t } = useTranslation()
  const { isAddingComment } = useReviewPanelValueContext()
  const { setIsAddingComment, submitNewComment, handleLayoutChange } =
    useReviewPanelUpdaterFnsContext()

  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmiting] = useState(false)

  const handleStartNewComment = () => {
    setIsAddingComment(true)
    handleLayoutChange({ async: true })
  }

  const handleSubmitNewComment = async () => {
    setIsSubmiting(true)
    try {
      await submitNewComment(content)
      setIsSubmiting(false)
      setIsAddingComment(false)
      setContent('')
    } catch (err) {
      setIsSubmiting(false)
    }
    handleLayoutChange({ async: true })
  }

  const handleCancelNewComment = () => {
    setIsAddingComment(false)
    setContent('')
    handleLayoutChange({ async: true })
  }

  useEffect(() => {
    return () => {
      setIsAddingComment(false)
    }
  }, [setIsAddingComment])

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
    <EntryContainer id={entryId}>
      <EntryCallout className="rp-entry-callout-add-comment" />
      <div
        className={classnames('rp-entry', 'rp-entry-add-comment', {
          'rp-entry-adding-comment': isAddingComment,
        })}
      >
        {isAddingComment ? (
          <>
            <div className="rp-new-comment">
              {isSubmitting ? (
                <div className="rp-loading">
                  <Icon type="spinner" spin />
                </div>
              ) : (
                <AutoExpandingTextArea
                  className="rp-comment-input"
                  onChange={e => setContent(e.target.value)}
                  onKeyPress={handleCommentKeyPress}
                  onResize={handleLayoutChange}
                  placeholder={t('add_your_comment_here')}
                  value={content}
                  autoFocus // eslint-disable-line jsx-a11y/no-autofocus
                />
              )}
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
                disabled={isSubmitting || !content.length}
              >
                <Icon type="comment" /> {t('comment')}
              </EntryActions.Button>
            </EntryActions>
          </>
        ) : (
          <AddCommentButton onClick={handleStartNewComment}>
            <Icon type="comment" /> {t('add_comment')}
          </AddCommentButton>
        )}
      </div>
    </EntryContainer>
  )
}

export default AddCommentEntry
