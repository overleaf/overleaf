import { FC, useMemo } from 'react'
import { MainDocument } from '../../../../../types/project-settings'
import { Ranges } from '../context/ranges-context'
import { ReviewPanelComment } from './review-panel-comment'
import { ReviewPanelChange } from './review-panel-change'
import { isDeleteChange, isInsertChange } from '@/utils/operations'
import {
  Change,
  DeleteOperation,
  EditOperation,
} from '../../../../../types/change'
import { canAggregate } from '../utils/can-aggregate'

import { Button } from 'react-bootstrap'
import MaterialIcon from '@/shared/components/material-icon'
import useOverviewFileCollapsed from '../hooks/use-overview-file-collapsed'
import { useThreadsContext } from '../context/threads-context'

export const ReviewPanelOverviewFile: FC<{
  doc: MainDocument
  ranges: Ranges
}> = ({ doc, ranges }) => {
  const { collapsed, toggleCollapsed } = useOverviewFileCollapsed(doc.doc.id)
  const threads = useThreadsContext()

  const { aggregates, changes } = useMemo(() => {
    const changes: Change<EditOperation>[] = []
    const aggregates: Map<string, Change<DeleteOperation>> = new Map()

    let precedingChange: Change<EditOperation> | null = null
    for (const change of ranges.changes) {
      if (
        precedingChange &&
        isInsertChange(precedingChange) &&
        isDeleteChange(change) &&
        canAggregate(change, precedingChange)
      ) {
        aggregates.set(precedingChange.id, change)
      } else {
        changes.push(change)
      }
      precedingChange = change
    }

    return { aggregates, changes }
  }, [ranges])

  const unresolvedComments = useMemo(() => {
    return ranges.comments.filter(comment => {
      const thread = threads?.[comment.op.t]
      return thread && !thread.resolved
    })
  }, [ranges.comments, threads])

  const numEntries = changes.length + unresolvedComments.length

  if (numEntries === 0) {
    return null
  }

  return (
    <div>
      <Button
        bsClass="review-panel-overview-file-header"
        bsStyle={null}
        onClick={toggleCollapsed}
      >
        <MaterialIcon
          type={collapsed ? 'keyboard_arrow_right' : 'keyboard_arrow_down'}
        />
        {doc.doc.name}
        <div className="review-panel-overview-file-entry-count">
          {numEntries}
        </div>
      </Button>

      {!collapsed && (
        <div className="review-panel-overview-file-entries">
          {changes.map(change => (
            <ReviewPanelChange
              key={change.id}
              change={change}
              aggregate={aggregates.get(change.id)}
            />
          ))}

          {unresolvedComments.map(comment => (
            <ReviewPanelComment key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  )
}
