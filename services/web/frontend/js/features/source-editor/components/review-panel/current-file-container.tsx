import { useCallback, useMemo } from 'react'
import Container from './container'
import Toolbar from './toolbar/toolbar'
import Nav from './nav'
import Toggler from './toggler'
import ChangeEntry from './entries/change-entry'
import AggregateChangeEntry from './entries/aggregate-change-entry'
import CommentEntry from './entries/comment-entry'
import AddCommentEntry from './entries/add-comment-entry'
import BulkActionsEntry from './entries/bulk-actions-entry/bulk-actions-entry'
import PositionedEntries from './positioned-entries'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../context/review-panel/review-panel-context'
import useCodeMirrorContentHeight from '../../hooks/use-codemirror-content-height'
import { ReviewPanelEntry } from '../../../../../../types/review-panel/entry'
import {
  ReviewPanelDocEntries,
  ThreadId,
} from '../../../../../../types/review-panel/review-panel'

const isEntryAThreadId = (
  entry: keyof ReviewPanelDocEntries
): entry is ThreadId => entry !== 'add-comment' && entry !== 'bulk-actions'

function CurrentFileContainer() {
  const {
    commentThreads,
    entries,
    openDocId,
    permissions,
    loadingThreads,
    users,
    entryHover,
    nVisibleSelectedChanges: nChanges,
    toggleReviewPanel,
  } = useReviewPanelValueContext()
  const { setEntryHover } = useReviewPanelUpdaterFnsContext()
  const contentHeight = useCodeMirrorContentHeight()

  const currentDocEntries =
    openDocId && openDocId in entries ? entries[openDocId] : undefined

  const objectEntries = useMemo(() => {
    return Object.entries(currentDocEntries || {}) as Array<
      [keyof ReviewPanelDocEntries, ReviewPanelEntry]
    >
  }, [currentDocEntries])

  const onMouseEnter = useCallback(() => {
    setEntryHover(true)
  }, [setEntryHover])

  const onMouseLeave = useCallback(() => {
    setEntryHover(false)
  }, [setEntryHover])

  return (
    <Container classNames={{ 'rp-collapsed-displaying-entry': entryHover }}>
      <div className="review-panel-tools">
        <Toolbar />
        <Nav />
      </div>
      <Toggler />
      <div
        id="review-panel-current-file"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby="review-panel-tab-current-file"
      >
        <PositionedEntries
          entries={objectEntries}
          contentHeight={contentHeight}
        >
          {openDocId &&
            objectEntries.map(([id, entry]) => {
              if (!entry.visible) {
                return null
              }

              if (
                isEntryAThreadId(id) &&
                (entry.type === 'insert' || entry.type === 'delete')
              ) {
                return (
                  <ChangeEntry
                    key={id}
                    docId={openDocId}
                    entry={entry}
                    entryId={id}
                    permissions={permissions}
                    user={users[entry.metadata.user_id]}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onIndicatorClick={toggleReviewPanel}
                  />
                )
              }

              if (isEntryAThreadId(id) && entry.type === 'aggregate-change') {
                return (
                  <AggregateChangeEntry
                    key={id}
                    docId={openDocId}
                    entry={entry}
                    entryId={id}
                    permissions={permissions}
                    user={users[entry.metadata.user_id]}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onIndicatorClick={toggleReviewPanel}
                  />
                )
              }

              if (
                isEntryAThreadId(id) &&
                entry.type === 'comment' &&
                !loadingThreads
              ) {
                return (
                  <CommentEntry
                    key={id}
                    docId={openDocId}
                    entry={entry}
                    entryId={id}
                    permissions={permissions}
                    threads={commentThreads}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    onIndicatorClick={toggleReviewPanel}
                  />
                )
              }

              if (entry.type === 'add-comment' && permissions.comment) {
                return <AddCommentEntry key={id} entryId={entry.type} />
              }

              if (entry.type === 'bulk-actions') {
                return (
                  <BulkActionsEntry
                    key={id}
                    entry={entry}
                    entryId={entry.type}
                    nChanges={nChanges}
                  />
                )
              }

              return null
            })}
        </PositionedEntries>
      </div>
    </Container>
  )
}

export default CurrentFileContainer
