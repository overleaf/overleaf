import { useMemo } from 'react'
import ChangeEntry from './entries/change-entry'
import AggregateChangeEntry from './entries/aggregate-change-entry'
import CommentEntry from './entries/comment-entry'
import AddCommentEntry from './entries/add-comment-entry'
import BulkActionsEntry from './entries/bulk-actions-entry'
import { useReviewPanelValueContext } from '../../context/review-panel/review-panel-context'
import useCodeMirrorContentHeight from '../../hooks/use-codemirror-content-height'
import { ReviewPanelEntry } from '../../../../../../types/review-panel/entry'
import { ThreadId } from '../../../../../../types/review-panel/review-panel'

function CurrentFileContainer() {
  const { commentThreads, entries, openDocId, permissions, loadingThreads } =
    useReviewPanelValueContext()
  const contentHeight = useCodeMirrorContentHeight()

  console.log('Review panel got content height', contentHeight)

  const currentDocEntries =
    openDocId && openDocId in entries ? entries[openDocId] : undefined

  const objectEntries = useMemo(() => {
    return Object.entries(currentDocEntries || {}) as Array<
      [ThreadId, ReviewPanelEntry]
    >
  }, [currentDocEntries])

  return (
    <div
      id="review-panel-current-file"
      role="tabpanel"
      tabIndex={0}
      aria-labelledby="review-panel-tab-current-file"
    >
      <div
        className="rp-entry-list-inner"
        style={{ height: `${contentHeight}px` }}
      >
        {openDocId &&
          objectEntries.map(([id, entry]) => {
            if (!entry.visible) {
              return null
            }

            if (entry.type === 'insert' || entry.type === 'delete') {
              return <ChangeEntry key={id} />
            }

            if (entry.type === 'aggregate-change') {
              return <AggregateChangeEntry key={id} />
            }

            if (entry.type === 'comment' && !loadingThreads) {
              return (
                <CommentEntry
                  key={id}
                  docId={openDocId}
                  entry={entry}
                  entryId={id}
                  threads={commentThreads}
                />
              )
            }

            if (entry.type === 'add-comment' && permissions.comment) {
              return <AddCommentEntry key={id} />
            }

            if (entry.type === 'bulk-actions') {
              return <BulkActionsEntry key={id} />
            }

            return null
          })}
      </div>
    </div>
  )
}

export default CurrentFileContainer
