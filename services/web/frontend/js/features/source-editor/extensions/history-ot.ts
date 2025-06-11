import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import {
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state'
import {
  CommentList,
  EditOperation,
  TextOperation,
  TrackingProps,
  TrackedChangeList,
} from 'overleaf-editor-core'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { HistoryOTShareDoc } from '../../../../../types/share-doc'

export const historyOT = (currentDoc: DocumentContainer) => {
  const trackedChanges =
    currentDoc.doc?.getTrackedChanges() ?? new TrackedChangeList([])
  const positionMapper = new PositionMapper(trackedChanges)
  return [
    updateSender,
    trackChangesUserIdState,
    shareDocState.init(() => currentDoc?.doc?._doc ?? null),
    commentsState,
    trackedChangesState.init(() => ({
      decorations: buildTrackedChangesDecorations(
        trackedChanges,
        positionMapper
      ),
      positionMapper,
    })),
    trackedChangesTheme,
  ]
}

export const shareDocState = StateField.define<HistoryOTShareDoc | null>({
  create() {
    return null
  },

  update(value) {
    // this state is constant
    return value
  },
})

const trackedChangesTheme = EditorView.baseTheme({
  '.ol-cm-change-i, .ol-cm-change-highlight-i, .ol-cm-change-focus-i': {
    backgroundColor: 'rgba(44, 142, 48, 0.30)',
  },
  '&light .ol-cm-change-c, &light .ol-cm-change-highlight-c, &light .ol-cm-change-focus-c':
    {
      backgroundColor: 'rgba(243, 177, 17, 0.30)',
    },
  '&dark .ol-cm-change-c, &dark .ol-cm-change-highlight-c, &dark .ol-cm-change-focus-c':
    {
      backgroundColor: 'rgba(194, 93, 11, 0.15)',
    },
  '.ol-cm-change': {
    padding: 'var(--half-leading, 0) 0',
  },
  '.ol-cm-change-highlight': {
    padding: 'var(--half-leading, 0) 0',
  },
  '.ol-cm-change-focus': {
    padding: 'var(--half-leading, 0) 0',
  },
  '&light .ol-cm-change-d': {
    borderLeft: '2px dotted #c5060b',
    marginLeft: '-1px',
  },
  '&dark .ol-cm-change-d': {
    borderLeft: '2px dotted #c5060b',
    marginLeft: '-1px',
  },
  '&light .ol-cm-change-d-highlight': {
    borderLeft: '3px solid #c5060b',
    marginLeft: '-2px',
  },
  '&dark .ol-cm-change-d-highlight': {
    borderLeft: '3px solid #c5060b',
    marginLeft: '-2px',
  },
  '&light .ol-cm-change-d-focus': {
    borderLeft: '3px solid #B83A33',
    marginLeft: '-2px',
  },
  '&dark .ol-cm-change-d-focus': {
    borderLeft: '3px solid #B83A33',
    marginLeft: '-2px',
  },
})

export const updateTrackedChangesEffect =
  StateEffect.define<TrackedChangeList>()

const buildTrackedChangesDecorations = (
  trackedChanges: TrackedChangeList,
  positionMapper: PositionMapper
) => {
  const decorations = []
  for (const change of trackedChanges.asSorted()) {
    if (change.tracking.type === 'insert') {
      decorations.push(
        Decoration.mark({
          class: 'ol-cm-change ol-cm-change-i',
          tracking: change.tracking,
        }).range(
          positionMapper.toCM6(change.range.pos),
          positionMapper.toCM6(change.range.end)
        )
      )
    } else {
      decorations.push(
        Decoration.widget({
          widget: new ChangeDeletedWidget(),
          side: 1,
        }).range(positionMapper.toCM6(change.range.pos))
      )
    }
  }

  return Decoration.set(decorations, true)
}

class ChangeDeletedWidget extends WidgetType {
  toDOM() {
    const widget = document.createElement('span')
    widget.classList.add('ol-cm-change')
    widget.classList.add('ol-cm-change-d')
    return widget
  }

  eq() {
    return true
  }
}

export const trackedChangesState = StateField.define({
  create() {
    return {
      decorations: Decoration.none,
      positionMapper: new PositionMapper(new TrackedChangeList([])),
    }
  },

  update(value, transaction) {
    if (
      (transaction.docChanged && !transaction.annotation(Transaction.remote)) ||
      transaction.effects.some(effect => effect.is(updateTrackedChangesEffect))
    ) {
      const shareDoc = transaction.startState.field(shareDocState)
      if (shareDoc != null) {
        const trackedChanges = shareDoc.snapshot.getTrackedChanges()
        const positionMapper = new PositionMapper(trackedChanges)
        value = {
          decorations: buildTrackedChangesDecorations(
            trackedChanges,
            positionMapper
          ),
          positionMapper,
        }
      }
    }

    return value
  },

  provide(field) {
    return EditorView.decorations.from(field, value => value.decorations)
  },
})

const setTrackChangesUserIdEffect = StateEffect.define<string | null>()

export const setTrackChangesUserId = (userId: string | null) => {
  return {
    effects: setTrackChangesUserIdEffect.of(userId),
  }
}

const trackChangesUserIdState = StateField.define<string | null>({
  create() {
    return null
  },

  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setTrackChangesUserIdEffect)) {
        value = effect.value
      }
    }
    return value
  },
})

const updateCommentsEffect = StateEffect.define<CommentList>()

export const updateComments = (comments: CommentList) => {
  return {
    effects: updateCommentsEffect.of(comments),
  }
}

const buildCommentsDecorations = (comments: CommentList) =>
  Decoration.set(
    comments.toArray().flatMap(comment =>
      comment.ranges.map(range =>
        Decoration.mark({
          class: 'tracked-change-comment',
          id: comment.id,
          resolved: comment.resolved,
        }).range(range.pos, range.end)
      )
    ),
    true
  )

const commentsState = StateField.define({
  create() {
    return Decoration.none // TODO: init from snapshot
  },

  update(value, transaction) {
    if (transaction.docChanged) {
      value = value.map(transaction.changes)
    }

    for (const effect of transaction.effects) {
      if (effect.is(updateCommentsEffect)) {
        value = buildCommentsDecorations(effect.value)
      }
    }

    return value
  },

  provide(field) {
    return EditorView.decorations.from(field)
  },
})

export const historyOTOperationEffect = StateEffect.define<EditOperation[]>()

const updateSender = EditorState.transactionExtender.of(tr => {
  if (!tr.docChanged || tr.annotation(Transaction.remote)) {
    return {}
  }

  const trackingUserId = tr.startState.field(trackChangesUserIdState)
  const positionMapper = tr.startState.field(trackedChangesState).positionMapper
  const startDoc = tr.startState.doc
  const opBuilder = new OperationBuilder(
    positionMapper.toSnapshot(startDoc.length)
  )

  if (trackingUserId == null) {
    // Not tracking changes
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      // insert
      if (inserted.length > 0) {
        const pos = positionMapper.toSnapshot(fromA)
        opBuilder.insert(pos, inserted.toString())
      }

      // deletion
      if (toA > fromA) {
        const start = positionMapper.toSnapshot(fromA)
        const end = positionMapper.toSnapshot(toA)
        opBuilder.delete(start, end - start)
      }
    })
  } else {
    // Tracking changes
    const timestamp = new Date()
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      // insertion
      if (inserted.length > 0) {
        const pos = positionMapper.toSnapshot(fromA)
        opBuilder.trackedInsert(
          pos,
          inserted.toString(),
          trackingUserId,
          timestamp
        )
      }

      // deletion
      if (toA > fromA) {
        const start = positionMapper.toSnapshot(fromA)
        const end = positionMapper.toSnapshot(toA)
        opBuilder.trackedDelete(start, end - start, trackingUserId, timestamp)
      }
    })
  }

  const op = opBuilder.finish()
  const shareDoc = tr.startState.field(shareDocState)
  if (shareDoc != null) {
    shareDoc.submitOp([op])
  }

  return {}
})

/**
 * Incrementally builds a TextOperation from a series of inserts and deletes.
 *
 * This relies on inserts and deletes being ordered by document position. This
 * is not clear in the documentation, but has been confirmed by Marijn in
 * https://discuss.codemirror.net/t/iterators-can-be-hard-to-work-with-for-beginners/3533/10
 */
class OperationBuilder {
  /**
   * Source document length
   */
  private docLength: number

  /**
   * Position in the source document
   */
  private pos: number

  /**
   * Operation built
   */
  private op: TextOperation

  constructor(docLength: number) {
    this.docLength = docLength
    this.op = new TextOperation()
    this.pos = 0
  }

  insert(pos: number, text: string) {
    this.retainUntil(pos)
    this.op.insert(text)
  }

  delete(pos: number, length: number) {
    this.retainUntil(pos)
    this.op.remove(length)
    this.pos += length
  }

  trackedInsert(pos: number, text: string, userId: string, timestamp: Date) {
    this.retainUntil(pos)
    this.op.insert(text, {
      tracking: new TrackingProps('insert', userId, timestamp),
    })
  }

  trackedDelete(pos: number, length: number, userId: string, timestamp: Date) {
    this.retainUntil(pos)
    this.op.retain(length, {
      tracking: new TrackingProps('delete', userId, timestamp),
    })
    this.pos += length
  }

  retainUntil(pos: number) {
    if (pos > this.pos) {
      this.op.retain(pos - this.pos)
      this.pos = pos
    } else if (pos < this.pos) {
      throw Error(
        `Out of order: position ${pos} comes before current position: ${this.pos}`
      )
    }
  }

  finish() {
    this.retainUntil(this.docLength)
    return this.op
  }
}

type OffsetTable = { pos: number; map: (pos: number) => number }[]

class PositionMapper {
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

  toCM6(snapshotPos: number) {
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
