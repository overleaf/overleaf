import React, { FC, useMemo } from 'react'
import { useThreadsContext } from '../context/threads-context'
import { useTranslation } from 'react-i18next'
import { ReviewPanelResolvedThread } from './review-panel-resolved-thread'
import useProjectRanges from '../hooks/use-project-ranges'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import { Change, CommentOperation } from '../../../../../types/change'
import { ThreadId } from '../../../../../types/review-panel/review-panel'
import LoadingSpinner from '@/shared/components/loading-spinner'
import OLBadge from '@/shared/components/ol/ol-badge'
import getMeta from '@/utils/meta'

export const ReviewPanelResolvedThreadsMenu: FC = () => {
  const { t } = useTranslation()
  const threads = useThreadsContext()
  const { docs } = useFileTreeData()

  const { projectRanges, loading } = useProjectRanges()

  const docNameForThread = useMemo(() => {
    const docNameForThread = new Map<string, string>()
    const otMigrationStage = getMeta('ol-otMigrationStage')

    for (const [docId, ranges] of projectRanges?.entries() ?? []) {
      const docName = docs?.find(
        doc => (otMigrationStage === 1 ? doc.path : doc.doc.id) === docId
      )?.doc.name
      if (docName !== undefined) {
        for (const comment of ranges.comments) {
          const threadId = comment.op.t
          docNameForThread.set(threadId, docName)
        }
      }
    }

    return docNameForThread
  }, [docs, projectRanges])

  const allComments = useMemo(() => {
    const allComments = new Map<
      string,
      Change<CommentOperation> & { resolved?: boolean }
    >()

    // eslint-disable-next-line no-unused-vars
    for (const [_, ranges] of projectRanges?.entries() ?? []) {
      for (const comment of ranges.comments) {
        allComments.set(comment.op.t, comment)
      }
    }

    return allComments
  }, [projectRanges])

  const resolvedThreads = useMemo(() => {
    if (!threads) {
      return []
    }

    const allResolvedThreads = []
    for (const [id, thread] of Object.entries(threads)) {
      // sharejs-text-ot has "resolved" on the thread; history-ot has "resolved" on the comment
      if (thread.resolved || allComments.get(id)?.resolved) {
        allResolvedThreads.push({ thread, id })
      }
    }
    allResolvedThreads.sort((a, b) => {
      // TODO: add "resolved_at"/"resolved_by" to history-ot comments?
      if (!a.thread.resolved_at || !b.thread.resolved_at) {
        return 0
      }
      return Date.parse(b.thread.resolved_at) - Date.parse(a.thread.resolved_at)
    })

    return allResolvedThreads.filter(thread => allComments.has(thread.id))
  }, [threads, allComments])

  if (loading) {
    return <LoadingSpinner className="ms-auto me-auto" />
  }

  if (!resolvedThreads.length) {
    return (
      <div className="review-panel-resolved-comments-empty">
        {t('no_resolved_comments')}
      </div>
    )
  }

  return (
    <>
      <div className="review-panel-resolved-comments-header">
        <div className="review-panel-resolved-comments-label">
          {t('resolved_comments')}
        </div>
        <OLBadge
          bg="light"
          text="dark"
          className="review-panel-resolved-comments-count"
        >
          {resolvedThreads.length}
        </OLBadge>
      </div>
      {resolvedThreads.map(thread => {
        const comment = allComments.get(thread.id)
        if (!comment) {
          return null
        }

        return (
          <ReviewPanelResolvedThread
            key={thread.id}
            id={thread.id as ThreadId}
            comment={comment}
            docName={docNameForThread.get(thread.id) ?? t('unknown')}
          />
        )
      })}
    </>
  )
}
