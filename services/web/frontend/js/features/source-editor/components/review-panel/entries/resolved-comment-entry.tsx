import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import Linkify from 'react-linkify'
import { formatTime } from '../../../../utils/format-date'
import { useReviewPanelValueContext } from '../../../context/review-panel/review-panel-context'

function LinkDecorator(
  decoratedHref: string,
  decoratedText: string,
  key: number
) {
  return (
    <a target="blank" rel="noreferrer noopener" href={decoratedHref} key={key}>
      {decoratedText}
    </a>
  )
}

type ResolvedCommentEntryProps = {
  thread: {
    resolved_at: number
    entryId: string
    docName: string
    content: string
    messages: Array<{
      id: string
      user: {
        id: string
        hue: string
        name: string
      }
      content: string
      timestamp: string
    }>
    resolved_by_user: {
      name: string
      hue: string
    }
  } // TODO extract type
  contentLimit?: number
}

function ResolvedCommentEntry({
  thread,
  contentLimit = 40,
}: ResolvedCommentEntryProps) {
  const { t } = useTranslation()
  const { permissions } = useReviewPanelValueContext()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const needsCollapsing = thread.content.length > contentLimit
  const content = isCollapsed
    ? thread.content.substring(0, contentLimit)
    : thread.content

  const handleUnresolve = () => {
    // TODO unresolve comment
  }

  const handleDelete = () => {
    // TODO delete thread
  }

  return (
    <div className="rp-resolved-comment">
      <div>
        <div className="rp-resolved-comment-context">
          {t('quoted_text_in')}
          &nbsp;
          <span className="rp-resolved-comment-context-file">
            {thread.docName}
          </span>
          <p className="rp-resolved-comment-context-quote">
            <span>{content}</span>
          </p>
          {needsCollapsing && (
            <>
              &nbsp;
              <button
                className="rp-collapse-toggle btn-inline-link"
                onClick={() => setIsCollapsed(value => !value)}
              >
                {isCollapsed ? `… (${t('show_all')})` : ` (${t('show_less')})`}
              </button>
            </>
          )}
        </div>
        {thread.messages.map((comment, index) => {
          const showUser =
            index === 0 ||
            comment.user.id !== thread.messages[index - 1].user.id

          return (
            <div className="rp-comment" key={comment.id}>
              <p className="rp-comment-content">
                {showUser && (
                  <span
                    className="rp-entry-user"
                    style={{ color: `hsl(${comment.user.hue}, 70%, 40%)` }}
                  >
                    {comment.user.name}:&nbsp;
                  </span>
                )}
                <Linkify componentDecorator={LinkDecorator}>
                  {comment.content}
                </Linkify>
              </p>
              <div className="rp-entry-metadata">
                {formatTime(comment.timestamp, 'MMM d, y h:mm a')}
              </div>
            </div>
          )
        })}
        <div className="rp-comment rp-comment-resolver">
          <p className="rp-comment-resolver-content">
            <span
              className="rp-entry-user"
              style={{ color: `hsl(${thread.resolved_by_user.hue}, 70%, 40%)` }}
            >
              {thread.resolved_by_user.name}:&nbsp;
            </span>
            {t('mark_as_resolved')}.
          </p>
          <div className="rp-entry-metadata">
            {formatTime(thread.resolved_at, 'MMM d, y h:mm a')}
          </div>
        </div>
      </div>
      {permissions.comment && permissions.write && (
        <div className="rp-entry-actions">
          <button className="rp-entry-button" onClick={handleUnresolve}>
            {t('reopen')}
          </button>
          <button className="rp-entry-button" onClick={handleDelete}>
            {t('delete')}
          </button>
        </div>
      )}
    </div>
  )
}

export default ResolvedCommentEntry
