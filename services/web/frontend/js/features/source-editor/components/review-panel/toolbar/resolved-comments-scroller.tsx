import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import ResolvedCommentEntry from './resolved-comment-entry'
import moment from 'moment'

type ResolvedCommentsScrollerProps = {
  resolvedComments: Array<{
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
  }> // TODO extract type
}

function ResolvedCommentsScroller({
  resolvedComments,
}: ResolvedCommentsScrollerProps) {
  const { t } = useTranslation()

  // TODO remove momentjs
  const sortedResolvedComments = useMemo(() => {
    return [...resolvedComments].sort(
      (a, b) =>
        moment(b.resolved_at).valueOf() - moment(a.resolved_at).valueOf()
    )
  }, [resolvedComments])

  return (
    <div className="resolved-comments-scroller">
      {sortedResolvedComments.map(comment => (
        <ResolvedCommentEntry key={comment.entryId} thread={comment} />
      ))}
      {!resolvedComments.length && (
        <div className="rp-loading">{t('no_resolved_threads')}</div>
      )}
    </div>
  )
}

export default ResolvedCommentsScroller
