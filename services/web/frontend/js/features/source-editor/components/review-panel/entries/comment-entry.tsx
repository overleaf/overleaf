import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import EntryContainer from './entry-container'
import EntryCallout from './entry-callout'
import EntryActions from './entry-actions'
import Comment from './comment'
import AutoExpandingTextArea, {
  resetHeight,
} from '../../../../../shared/components/auto-expanding-text-area'
import Icon from '../../../../../shared/components/icon'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../../context/review-panel/review-panel-context'
import classnames from 'classnames'
import { ReviewPanelCommentEntry } from '../../../../../../../types/review-panel/entry'
import {
  ReviewPanelCommentThreads,
  ReviewPanelPermissions,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { DocId } from '../../../../../../../types/project-settings'

type CommentEntryProps = {
  docId: DocId
  entry: ReviewPanelCommentEntry
  entryId: ThreadId
  permissions: ReviewPanelPermissions
  threads: ReviewPanelCommentThreads
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onIndicatorClick?: () => void
}

function CommentEntry({
  docId,
  entry,
  entryId,
  permissions,
  threads,
  onMouseEnter,
  onMouseLeave,
  onIndicatorClick,
}: CommentEntryProps) {
  const { t } = useTranslation()
  const { gotoEntry, resolveComment, submitReply } =
    useReviewPanelValueContext()
  const { handleLayoutChange } = useReviewPanelUpdaterFnsContext()
  const [replyContent, setReplyContent] = useState('')
  const [animating, setAnimating] = useState(false)
  const [resolved, setResolved] = useState(false)
  const entryDivRef = useRef<HTMLDivElement | null>(null)

  const thread =
    entry.thread_id in threads ? threads[entry.thread_id] : undefined

  const handleEntryClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as Element

    for (const selector of [
      '.rp-entry',
      '.rp-comment-loaded',
      '.rp-comment-content',
      '.rp-comment-reply',
      '.rp-entry-metadata',
    ]) {
      if (target.matches(selector)) {
        gotoEntry(docId, entry.offset)
        break
      }
    }
  }

  const handleAnimateAndCallOnResolve = () => {
    setAnimating(true)

    if (entryDivRef.current) {
      entryDivRef.current.style.top = '0'
    }

    setTimeout(() => {
      setAnimating(false)
      setResolved(true)
      resolveComment(docId, entryId)
    }, 350)
  }

  const handleCommentReplyKeyPress = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault()

      if (replyContent.length) {
        ;(e.target as HTMLTextAreaElement).blur()
        submitReply(entry, replyContent)
        setReplyContent('')
        resetHeight(e)
      }
    }
  }

  const handleOnReply = () => {
    if (replyContent.length) {
      submitReply(entry, replyContent)
      setReplyContent('')
    }
  }

  const submitting = Boolean(thread?.submitting)

  // Update the layout when loading finishes
  useEffect(() => {
    if (!submitting) {
      // Ensure everything is rendered in the DOM before updating the layout.
      // Having to use a timeout seems less than ideal.
      window.setTimeout(handleLayoutChange, 0)
    }
  }, [submitting, handleLayoutChange])

  if (!thread || resolved) {
    return null
  }

  return (
    <EntryContainer
      id={entryId}
      onClick={handleEntryClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={classnames('rp-comment-wrapper', {
          'rp-comment-wrapper-resolving': animating,
        })}
      >
        <EntryCallout className="rp-entry-callout-comment" />
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className={classnames('rp-entry-indicator', {
            'rp-entry-indicator-focused': entry.focused,
          })}
          onClick={onIndicatorClick}
        >
          <Icon type="comment" />
        </div>
        <div
          className={classnames('rp-entry', 'rp-entry-comment', {
            'rp-entry-focused': entry.focused,
            'rp-entry-comment-resolving': animating,
          })}
          ref={entryDivRef}
        >
          {!submitting && (!thread || thread.messages.length === 0) && (
            <div className="rp-loading">{t('no_comments')}</div>
          )}
          <div className="rp-comment-loaded">
            {thread.messages.map(comment => (
              <Comment
                key={comment.id}
                thread={thread}
                threadId={entry.thread_id}
                comment={comment}
              />
            ))}
          </div>
          {submitting && (
            <div className="rp-loading">
              <Icon type="spinner" spin />
            </div>
          )}
          {permissions.comment && (
            <div className="rp-comment-reply">
              <AutoExpandingTextArea
                className="rp-comment-input"
                onChange={e => setReplyContent(e.target.value)}
                onKeyPress={handleCommentReplyKeyPress}
                onClick={e => e.stopPropagation()}
                onResize={handleLayoutChange}
                placeholder={t('hit_enter_to_reply')}
                value={replyContent}
              />
            </div>
          )}
          <EntryActions>
            {permissions.comment && permissions.write && (
              <EntryActions.Button onClick={handleAnimateAndCallOnResolve}>
                <Icon type="inbox" /> {t('resolve')}
              </EntryActions.Button>
            )}
            {permissions.comment && (
              <EntryActions.Button
                onClick={handleOnReply}
                disabled={!replyContent.length}
              >
                <Icon type="reply" /> {t('reply')}
              </EntryActions.Button>
            )}
          </EntryActions>
        </div>
      </div>
    </EntryContainer>
  )
}

export default CommentEntry
