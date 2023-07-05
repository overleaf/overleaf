import { useMemo, useRef } from 'react'
import Icon from '../../../../shared/components/icon'
import ChangeEntry from './entries/change-entry'
import AggregateChangeEntry from './entries/aggregate-change-entry'
import CommentEntry from './entries/comment-entry'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../context/review-panel/review-panel-context'
import classnames from 'classnames'
import { ThreadId } from '../../../../../../types/review-panel/review-panel'
import { MainDocument } from '../../../../../../types/project-settings'
import { ReviewPanelEntry } from '../../../../../../types/review-panel/entry'
import useCollapseHeight from './hooks/use-collapse-height'

type OverviewFileProps = {
  docId: MainDocument['doc']['id']
  docPath: MainDocument['path']
}

function OverviewFile({ docId, docPath }: OverviewFileProps) {
  const { entries, collapsed, commentThreads, permissions, users } =
    useReviewPanelValueContext()
  const { setCollapsed } = useReviewPanelUpdaterFnsContext()

  const docCollapsed = collapsed[docId]
  const docEntries = useMemo(
    () => (docId in entries ? entries[docId] : {}),
    [docId, entries]
  )
  const objectEntries = useMemo(() => {
    const entries = Object.entries(docEntries) as Array<
      [ThreadId, ReviewPanelEntry]
    >

    const orderedEntries = entries.sort(([, entryA], [, entryB]) => {
      return entryA.offset - entryB.offset
    })

    return orderedEntries
  }, [docEntries])
  const entryCount = Object.keys(docEntries).length

  const handleToggleCollapsed = () => {
    setCollapsed({ ...collapsed, [docId]: !docCollapsed })
  }

  const entriesContainerRef = useRef<HTMLDivElement | null>(null)
  useCollapseHeight(entriesContainerRef, docCollapsed)

  return (
    <div className="rp-overview-file">
      {entryCount > 0 && (
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div
          className="rp-overview-file-header"
          onClick={handleToggleCollapsed}
        >
          <span
            className={classnames('rp-overview-file-header-collapse', {
              'rp-overview-file-header-collapse-on': docCollapsed,
            })}
          >
            <Icon type="angle-down" />
          </span>
          {docPath}
          {docCollapsed && (
            <>
              &nbsp;
              <span className="rp-overview-file-num-entries">
                ({entryCount})
              </span>
            </>
          )}
        </div>
      )}
      <div className="rp-overview-file-entries" ref={entriesContainerRef}>
        {objectEntries.map(([id, entry]) => {
          if (entry.type === 'insert' || entry.type === 'delete') {
            return (
              <ChangeEntry
                key={id}
                docId={docId}
                entry={entry}
                permissions={permissions}
                user={users[entry.metadata.user_id]}
              />
            )
          }

          if (entry.type === 'aggregate-change') {
            return <AggregateChangeEntry key={id} />
          }

          if (entry.type === 'comment') {
            if (!commentThreads[entry.thread_id]?.resolved) {
              return (
                <CommentEntry
                  key={id}
                  docId={docId}
                  entry={entry}
                  entryId={id}
                  permissions={permissions}
                  threads={commentThreads}
                />
              )
            }
          }

          return null
        })}
      </div>
    </div>
  )
}

export default OverviewFile
