import { TrackedChangeList } from 'overleaf-editor-core'
import { EditorState } from '@codemirror/state'
import { rangesState } from '@/features/source-editor/extensions/history-ot'

export const trackedDeletesFromState = (state: EditorState) =>
  new TrackedDeletes(state.field(rangesState).trackedChanges)

type OffsetTable = { pos: number; map: (pos: number) => number }[]

export class TrackedDeletes {
  private offsets: {
    toCM6: OffsetTable
    toSnapshot: OffsetTable
  }

  constructor(trackedChanges: TrackedChangeList) {
    this.offsets = {
      toCM6: [{ pos: 0, map: pos => pos }],
      toSnapshot: [{ pos: 0, map: pos => pos }],
    }

    // Offset of the snapshot pos relative to the CM6 pos
    let offset = 0
    for (const change of trackedChanges.asSorted()) {
      if (change.tracking.type === 'delete') {
        const deleteLength = change.range.length
        const deletePos = change.range.pos
        const oldOffset = offset
        const newOffset = offset + deleteLength
        this.offsets.toSnapshot.push({
          pos: change.range.pos - offset + 1,
          map: pos => pos + newOffset,
        })
        this.offsets.toCM6.push({
          pos: change.range.pos,
          map: () => deletePos - oldOffset,
        })
        this.offsets.toCM6.push({
          pos: change.range.pos + deleteLength,
          map: pos => pos - newOffset,
        })
        offset = newOffset
      }
    }
  }

  toCodeMirror(snapshotPos: number) {
    return this.mapPos(snapshotPos, this.offsets.toCM6)
  }

  toSnapshot(cm6Pos: number) {
    return this.mapPos(cm6Pos, this.offsets.toSnapshot)
  }

  mapPos(pos: number, offsets: OffsetTable) {
    // Binary search for the offset at the last position before pos
    let low = 0
    let high = offsets.length - 1
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      const entry = offsets[middle]
      if (entry.pos < pos) {
        // This entry could be the right offset, but lower entries are too low
        // Because we used Math.ceil(), middle is higher than low and the
        // algorithm progresses.
        low = middle
      } else if (entry.pos > pos) {
        // This entry is too high
        high = middle - 1
      } else {
        // This is the right entry
        return entry.map(pos)
      }
    }
    return offsets[low].map(pos)
  }
}
