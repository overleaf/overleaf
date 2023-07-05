import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import EntryContainer from './entry-container'
import Comment from './comment'
import EntryActions from './entry-actions'
import AutoExpandingTextArea, {
  resetHeight,
} from '../../../../../shared/components/auto-expanding-text-area'
import Icon from '../../../../../shared/components/icon'
import { useReviewPanelValueContext } from '../../../context/review-panel/review-panel-context'
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
  const { gotoEntry, resolveComment, submitReply, handleLayoutChange } =
    useReviewPanelValueContext()
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

  if (!thread || resolved) {
    return null
  }

  return (
    <EntryContainer
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
        <div
          className="rp-entry-callout rp-entry-callout-comment"
          style={{
            top: entry.screenPos
              ? entry.screenPos.y + entry.screenPos.height - 1 + 'px'
              : undefined,
          }}
        />
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div
          className={classnames('rp-entry-indicator', {
            'rp-entry-indicator-focused': entry.focused,
          })}
          style={{
            top: entry.screenPos ? `${entry.screenPos.y}px` : undefined,
          }}
          onClick={onIndicatorClick}
        >
          <Icon type="comment" />
        </div>
        <div
          className={classnames('rp-entry', 'rp-entry-comment', {
            'rp-entry-focused': entry.focused,
            'rp-entry-comment-resolving': animating,
          })}
          style={{
            top: entry.screenPos ? `${entry.screenPos.y}px` : undefined,
            visibility: entry.visible ? 'visible' : 'hidden',
          }}
          ref={entryDivRef}
        >
          {!thread.submitting && (!thread || thread.messages.length === 0) && (
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
          {thread.submitting && (
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
