import { useState, useRef, useEffect, memo } from 'react'
import { useTranslation } from 'react-i18next'
import EntryContainer from './entry-container'
import EntryCallout from './entry-callout'
import EntryActions from './entry-actions'
import Comment from './comment'
import AutoExpandingTextArea from '../../../../../shared/components/auto-expanding-text-area'
import Icon from '../../../../../shared/components/icon'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import classnames from 'classnames'
import { ThreadId } from '../../../../../../../types/review-panel/review-panel'
import { Permissions } from '@/features/ide-react/types/permissions'
import { DocId } from '../../../../../../../types/project-settings'
import { ReviewPanelCommentThread } from '../../../../../../../types/review-panel/comment-thread'
import { ReviewPanelCommentEntry } from '../../../../../../../types/review-panel/entry'
import useIndicatorHover from '../hooks/use-indicator-hover'
import EntryIndicator from './entry-indicator'
import { useEntryClick } from '@/features/source-editor/components/review-panel/hooks/use-entry-click'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import LoadingSpinner from '@/shared/components/loading-spinner'

type CommentEntryProps = {
  docId: DocId
  entryId: ThreadId
  thread: ReviewPanelCommentThread | undefined
  threadId: ReviewPanelCommentEntry['thread_id']
  permissions: Permissions
} & Pick<ReviewPanelCommentEntry, 'offset' | 'focused'>

function CommentEntry({
  docId,
  entryId,
  thread,
  threadId,
  offset,
  focused,
  permissions,
}: CommentEntryProps) {
  const { t } = useTranslation()
  const { resolveComment, submitReply, handleLayoutChange } =
    useReviewPanelUpdaterFnsContext()
  const [replyContent, setReplyContent] = useState('')
  const [animating, setAnimating] = useState(false)
  const [resolved, setResolved] = useState(false)
  const entryDivRef = useRef<HTMLDivElement | null>(null)
  const {
    hoverCoords,
    indicatorRef,
    endHover,
    handleIndicatorMouseEnter,
    handleIndicatorClick,
  } = useIndicatorHover()

  const handleEntryClick = useEntryClick(docId, offset)

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
        submitReply(threadId, replyContent)
        setReplyContent('')
      }
    }
  }

  const handleOnReply = () => {
    if (replyContent.length) {
      submitReply(threadId, replyContent)
      setReplyContent('')
    }
  }

  const submitting = Boolean(thread?.submitting)

  // Update the layout when loading finishes
  useEffect(() => {
    if (!submitting) {
      // Ensure everything is rendered in the DOM before updating the layout.
      handleLayoutChange({ async: true })
    }
  }, [submitting, handleLayoutChange])

  if (!thread || resolved) {
    return null
  }

  return (
    <EntryContainer
      id={entryId}
      hoverCoords={hoverCoords}
      onClick={handleEntryClick}
      onMouseLeave={endHover}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={classnames('rp-comment-wrapper', {
          'rp-comment-wrapper-resolving': animating,
        })}
      >
        <EntryCallout className="rp-entry-callout-comment" />
        <EntryIndicator
          ref={indicatorRef}
          focused={focused}
          onMouseEnter={handleIndicatorMouseEnter}
          onClick={handleIndicatorClick}
        >
          <BootstrapVersionSwitcher
            bs3={<Icon type="comment" />}
            bs5={<MaterialIcon type="mode_comment" />}
          />
        </EntryIndicator>
        <div
          className={classnames('rp-entry', 'rp-entry-comment', {
            'rp-entry-focused': focused,
            'rp-entry-comment-resolving': animating,
          })}
          ref={entryDivRef}
        >
          {!submitting && (!thread || thread.messages.length === 0) && (
            <div className="text-center p-1">{t('no_comments')}</div>
          )}
          <div className="rp-comment-loaded">
            {thread.messages.map(comment => (
              <Comment
                key={comment.id}
                thread={thread}
                threadId={threadId}
                comment={comment}
              />
            ))}
          </div>
          {submitting && (
            <LoadingSpinner className="d-flex justify-content-center" />
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
                <BootstrapVersionSwitcher
                  bs3={<Icon type="inbox" />}
                  bs5={<MaterialIcon type="inbox" />}
                />
                &nbsp;{t('resolve')}
              </EntryActions.Button>
            )}
            {permissions.comment && (
              <EntryActions.Button
                onClick={handleOnReply}
                disabled={!replyContent.length}
              >
                <BootstrapVersionSwitcher
                  bs3={<Icon type="reply" />}
                  bs5={<MaterialIcon type="reply" />}
                />
                &nbsp;{t('reply')}
              </EntryActions.Button>
            )}
          </EntryActions>
        </div>
      </div>
    </EntryContainer>
  )
}

export default memo(CommentEntry)
