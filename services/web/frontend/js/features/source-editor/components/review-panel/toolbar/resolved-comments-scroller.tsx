import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import ResolvedCommentEntry from '../entries/resolved-comment-entry'
import { FilteredResolvedComments } from './resolved-comments-dropdown'

type ResolvedCommentsScrollerProps = {
  resolvedComments: FilteredResolvedComments[]
}

function ResolvedCommentsScroller({
  resolvedComments,
}: ResolvedCommentsScrollerProps) {
  const { t } = useTranslation()

  const sortedResolvedComments = useMemo(() => {
    return [...resolvedComments].sort((a, b) => {
      return Date.parse(b.resolved_at) - Date.parse(a.resolved_at)
    })
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
