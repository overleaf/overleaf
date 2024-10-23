import { useTranslation } from 'react-i18next'
import { memo, useState } from 'react'
import Linkify from 'react-linkify'
import { formatTime } from '../../../../utils/format-date'
import { useReviewPanelUpdaterFnsContext } from '../../../context/review-panel/review-panel-context'
import { FilteredResolvedComments } from '../toolbar/resolved-comments-dropdown'
import { Permissions } from '@/features/ide-react/types/permissions'

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
  thread: FilteredResolvedComments
  permissions: Permissions
  contentLimit?: number
}

function ResolvedCommentEntry({
  thread,
  permissions,
  contentLimit = 40,
}: ResolvedCommentEntryProps) {
  const { t } = useTranslation()
  const { unresolveComment, deleteThread } = useReviewPanelUpdaterFnsContext()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const needsCollapsing = thread.content.length > contentLimit
  const content = isCollapsed
    ? thread.content.substring(0, contentLimit)
    : thread.content

  const handleUnresolve = () => {
    unresolveComment(thread.docId, thread.threadId)
  }

  const handleDelete = () => {
    deleteThread(thread.docId, thread.threadId)
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
                className="rp-collapse-toggle"
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
                {formatTime(comment.timestamp, 'MMM D, Y h:mm A')}
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
            {formatTime(thread.resolved_at, 'MMM D, Y h:mm A')}
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

export default memo(ResolvedCommentEntry)
