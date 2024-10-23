import { useTranslation } from 'react-i18next'
import { useState, useMemo, useCallback } from 'react'
import Icon from '../../../../../shared/components/icon'
import ResolvedCommentsScroller from './resolved-comments-scroller'
import classnames from 'classnames'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../../context/review-panel/review-panel-context'
import {
  ReviewPanelDocEntries,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { ReviewPanelResolvedCommentThread } from '../../../../../../../types/review-panel/comment-thread'
import { DocId } from '../../../../../../../types/project-settings'
import { ReviewPanelEntry } from '../../../../../../../types/review-panel/entry'
import { useFileTreeData } from '@/shared/context/file-tree-data-context'
import LoadingSpinner from '@/shared/components/loading-spinner'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import MaterialIcon from '@/shared/components/material-icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

export interface FilteredResolvedComments
  extends ReviewPanelResolvedCommentThread {
  content: string
  threadId: ThreadId
  entryId: ThreadId
  docId: DocId
  docName: string | null
}

function ResolvedCommentsDropdown() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { commentThreads, resolvedComments, permissions } =
    useReviewPanelValueContext()
  const { docs } = useFileTreeData()

  const { refreshResolvedCommentsDropdown } = useReviewPanelUpdaterFnsContext()

  const handleResolvedCommentsClick = () => {
    setIsOpen(isOpen => {
      if (!isOpen) {
        setIsLoading(true)
        refreshResolvedCommentsDropdown().finally(() => setIsLoading(false))
      }

      return !isOpen
    })
  }

  const getDocNameById = useCallback(
    (docId: DocId) => {
      return docs?.find(doc => doc.doc.id === docId)?.doc.name || null
    },
    [docs]
  )

  const filteredResolvedComments = useMemo(() => {
    const comments: FilteredResolvedComments[] = []

    for (const [docId, docEntries] of Object.entries(resolvedComments) as Array<
      [DocId, ReviewPanelDocEntries]
    >) {
      for (const [entryId, entry] of Object.entries(docEntries) as Array<
        [ThreadId, ReviewPanelEntry]
      >) {
        if (entry.type === 'comment') {
          const threadId = entry.thread_id
          const thread =
            threadId in commentThreads
              ? commentThreads[entry.thread_id]
              : undefined

          if (thread?.resolved) {
            comments.push({
              ...thread,
              content: entry.content,
              threadId,
              entryId,
              docId,
              docName: getDocNameById(docId),
            })
          }
        }
      }
    }

    return comments
  }, [commentThreads, getDocNameById, resolvedComments])

  return (
    <div className="resolved-comments">
      <div
        aria-hidden="true"
        className={classnames('resolved-comments-backdrop', {
          'resolved-comments-backdrop-visible': isOpen,
        })}
        onClick={() => setIsOpen(false)}
      />

      <OLTooltip
        id="resolved-comments-toggle"
        description={t('resolved_comments')}
        overlayProps={{ container: document.body, placement: 'bottom' }}
      >
        <button
          className="resolved-comments-toggle"
          onClick={handleResolvedCommentsClick}
          aria-label={t('resolved_comments')}
        >
          <BootstrapVersionSwitcher
            bs3={<Icon type="inbox" />}
            bs5={<MaterialIcon type="inbox" />}
          />
        </button>
      </OLTooltip>

      <div
        className={classnames('resolved-comments-dropdown', {
          'resolved-comments-dropdown-open': isOpen,
        })}
      >
        {isLoading ? (
          <LoadingSpinner className="d-flex justify-content-center my-2" />
        ) : isOpen ? (
          <ResolvedCommentsScroller
            resolvedComments={filteredResolvedComments}
            permissions={permissions}
          />
        ) : null}
      </div>
    </div>
  )
}

export default ResolvedCommentsDropdown
