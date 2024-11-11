import { SelectionRange } from '@codemirror/state'
import { Ranges } from '@/features/review-panel-new/context/ranges-context'
import { isDeleteChange, isInsertChange } from '@/utils/operations'
import { canAggregate } from './can-aggregate'
import { Change, EditOperation } from '../../../../../types/change'

export function numberOfChangesInSelection(
  ranges: Ranges | undefined,
  selection: SelectionRange
) {
  if (!ranges) {
    return 0
  }

  let count = 0
  let precedingChange: Change<EditOperation> | null = null

  for (const change of ranges.changes) {
    if (
      precedingChange &&
      isInsertChange(precedingChange) &&
      isDeleteChange(change) &&
      canAggregate(change, precedingChange)
    ) {
      // only count once for the aggregated change
      continue
    } else if (
      isInsertChange(change) &&
      change.op.p >= selection.from &&
      change.op.p + change.op.i.length <= selection.to
    ) {
      count++
    } else if (
      isDeleteChange(change) &&
      selection.from <= change.op.p &&
      change.op.p <= selection.to
    ) {
      count++
    }
    precedingChange = change
  }

  return count
}
