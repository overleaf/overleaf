import { memo } from 'react'
import ChangeEntry from './entries/change-entry'
import AggregateChangeEntry from './entries/aggregate-change-entry'
import CommentEntry from './entries/comment-entry'
import AddCommentEntry from './entries/add-comment-entry'
import BulkActionsEntry from './entries/bulk-actions-entry/bulk-actions-entry'
import {
  ReviewPanelDocEntries,
  ThreadId,
} from '../../../../../../types/review-panel/review-panel'
import { useReviewPanelValueContext } from '../../context/review-panel/review-panel-context'
import { useEditorContext } from '../../../../shared/context/editor-context'

type Props = {
  entry: ReviewPanelDocEntries[keyof ReviewPanelDocEntries]
  id: ThreadId | 'add-comment' | 'bulk-actions'
}

const isEntryAThreadId = (
  entry: keyof ReviewPanelDocEntries
): entry is ThreadId => entry !== 'add-comment' && entry !== 'bulk-actions'

function Entry({ entry, id }: Props) {
  const {
    commentThreads,
    openDocId,
    permissions,
    loadingThreads,
    users,
    nVisibleSelectedChanges: nChanges,
  } = useReviewPanelValueContext()
  const { isRestrictedTokenMember } = useEditorContext()

  if (!entry.visible || !openDocId) {
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
        entryId={id}
        permissions={permissions}
        user={users[entry.metadata.user_id]}
        content={entry.content}
        offset={entry.offset}
        type={entry.type}
        focused={entry.focused}
        entryIds={entry.entry_ids}
        timestamp={entry.metadata.ts}
      />
    )
  }

  if (isEntryAThreadId(id) && entry.type === 'aggregate-change') {
    return (
      <AggregateChangeEntry
        key={id}
        docId={openDocId}
        entryId={id}
        permissions={permissions}
        user={users[entry.metadata.user_id]}
        content={entry.content}
        replacedContent={entry.metadata.replaced_content}
        offset={entry.offset}
        focused={entry.focused}
        entryIds={entry.entry_ids}
        timestamp={entry.metadata.ts}
      />
    )
  }

  if (isEntryAThreadId(id) && entry.type === 'comment' && !loadingThreads) {
    return (
      <CommentEntry
        key={id}
        docId={openDocId}
        threadId={entry.thread_id}
        thread={commentThreads[entry.thread_id]}
        entryId={id}
        offset={entry.offset}
        focused={entry.focused}
        permissions={permissions}
      />
    )
  }

  if (
    entry.type === 'add-comment' &&
    permissions.comment &&
    !isRestrictedTokenMember
  ) {
    return <AddCommentEntry key={id} />
  }

  if (entry.type === 'bulk-actions' && permissions.write) {
    return (
      <BulkActionsEntry key={id} entryId={entry.type} nChanges={nChanges} />
    )
  }

  return null
}

export default memo(Entry)
