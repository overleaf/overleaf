import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
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
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import LoadingSpinner from '@/shared/components/loading-spinner'

function AddCommentEntry() {
  const { t } = useTranslation()
  const { isAddingComment, unsavedComment } = useReviewPanelValueContext()
  const {
    setIsAddingComment,
    submitNewComment,
    handleLayoutChange,
    setUnsavedComment,
  } = useReviewPanelUpdaterFnsContext()

  const [content, setContent] = useState(unsavedComment)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleStartNewComment = () => {
    setIsAddingComment(true)
    handleLayoutChange({ async: true })
  }

  const handleSubmitNewComment = () => {
    setIsSubmitting(true)
    try {
      submitNewComment(content)
      setIsSubmitting(false)
      setIsAddingComment(false)
      setContent('')
    } catch (err) {
      setIsSubmitting(false)
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

  const unsavedCommentRef = useRef(unsavedComment)

  // Keep unsaved comment ref up to date for use when the component unmounts
  useEffect(() => {
    unsavedCommentRef.current = content
  }, [content])

  // Store the unsaved comment in the context on unmount
  useEffect(() => {
    return () => {
      setUnsavedComment(unsavedCommentRef.current)
    }
  }, [setUnsavedComment])

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

  const handleCommentAutoFocus = (textarea: HTMLTextAreaElement) => {
    // Sometimes the comment textarea is scrolled out of view once focussed,
    // so this checks for that and scrolls it into view if necessary. It
    // seems we sometimes need to allow time for the dust to settle after
    // focussing the textarea before scrolling.
    window.setTimeout(() => {
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.intersectionRatio < 1) {
          textarea.scrollIntoView({ block: 'center' })
        }
        observer.disconnect()
      })
      observer.observe(textarea)
    }, 500)
  }

  return (
    <EntryContainer id="add-comment">
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
                <LoadingSpinner className="d-flex justify-content-center" />
              ) : (
                <AutoExpandingTextArea
                  className="rp-comment-input"
                  onChange={e => setContent(e.target.value)}
                  onKeyPress={handleCommentKeyPress}
                  onResize={handleLayoutChange}
                  onAutoFocus={handleCommentAutoFocus}
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
                <BootstrapVersionSwitcher
                  bs3={<Icon type="times" />}
                  bs5={<MaterialIcon type="close" />}
                />
                &nbsp;
                {t('cancel')}
              </EntryActions.Button>
              <EntryActions.Button
                onClick={handleSubmitNewComment}
                disabled={isSubmitting || !content.length}
              >
                <BootstrapVersionSwitcher
                  bs3={<Icon type="comment" />}
                  bs5={<MaterialIcon type="mode_comment" />}
                />
                &nbsp;
                {t('comment')}
              </EntryActions.Button>
            </EntryActions>
          </>
        ) : (
          <AddCommentButton onClick={handleStartNewComment}>
            <BootstrapVersionSwitcher
              bs3={<Icon type="comment" />}
              bs5={<MaterialIcon type="mode_comment" />}
            />
            &nbsp;
            {t('add_comment')}
          </AddCommentButton>
        )}
      </div>
    </EntryContainer>
  )
}

export default AddCommentEntry
