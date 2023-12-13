import { useMemo } from 'react'
import ChangeEntry from '@/features/source-editor/components/review-panel/entries/change-entry'
import AggregateChangeEntry from '@/features/source-editor/components/review-panel/entries/aggregate-change-entry'
import CommentEntry from '@/features/source-editor/components/review-panel/entries/comment-entry'
import { useReviewPanelValueContext } from '@/features/source-editor/context/review-panel/review-panel-context'
import {
  ReviewPanelDocEntries,
  ThreadId,
} from '../../../../../../../types/review-panel/review-panel'
import { ReviewPanelEntry } from '../../../../../../../types/review-panel/entry'
import { DocId } from '../../../../../../../types/project-settings'

type OverviewFileEntriesProps = {
  docId: DocId
  docEntries: ReviewPanelDocEntries
}

function OverviewFileEntries({ docId, docEntries }: OverviewFileEntriesProps) {
  const { commentThreads, permissions, users } = useReviewPanelValueContext()

  const objectEntries = useMemo(() => {
    const entries = Object.entries(docEntries) as Array<
      [ThreadId, ReviewPanelEntry]
    >

    const orderedEntries = entries.sort(([, entryA], [, entryB]) => {
      return entryA.offset - entryB.offset
    })

    return orderedEntries
  }, [docEntries])

  return (
    <div className="rp-overview-file-entries">
      {objectEntries.map(([id, entry]) => {
        if (entry.type === 'insert' || entry.type === 'delete') {
          return (
            <ChangeEntry
              key={id}
              docId={docId}
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

        if (entry.type === 'aggregate-change') {
          return (
            <AggregateChangeEntry
              key={id}
              docId={docId}
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

        if (entry.type === 'comment') {
          const thread = commentThreads[entry.thread_id]
          if (!thread?.resolved) {
            return (
              <CommentEntry
                key={id}
                docId={docId}
                threadId={entry.thread_id}
                thread={thread}
                entryId={id}
                offset={entry.offset}
                focused={entry.focused}
                permissions={permissions}
              />
            )
          }
        }

        return null
      })}
    </div>
  )
}

export default OverviewFileEntries
