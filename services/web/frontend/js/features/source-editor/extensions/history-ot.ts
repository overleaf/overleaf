import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import {
  EditorState,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state'
import {
  CommentList,
  TextOperation,
  TrackingProps,
  TrackedChangeList,
} from 'overleaf-editor-core'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { HistoryOTShareDoc } from '../../../../../types/share-doc'
import {
  TrackedDeletes,
  trackedDeletesFromState,
} from '@/features/source-editor/utils/tracked-deletes'

export const historyOT = (currentDoc: DocumentContainer) => {
  const trackedChanges =
    currentDoc.historyOTShareDoc.snapshot.getTrackedChanges() ??
    new TrackedChangeList([])
  const comments =
    currentDoc.historyOTShareDoc.snapshot.getComments() ?? new CommentList([])
  return [
    updateSender,
    trackChangesUserIdState,
    shareDocState.init(() => currentDoc?.doc?._doc ?? null),
    rangesState.init(() => ({
      trackedChanges,
      comments,
      decorations: buildRangesDecorations({ trackedChanges, comments }),
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

export const rangesUpdatedEffect = StateEffect.define()

const buildRangesDecorations = ({
  trackedChanges,
  comments,
}: {
  trackedChanges: TrackedChangeList
  comments: CommentList
}) => {
  if (trackedChanges.length === 0 && comments.length === 0) {
    return Decoration.none
  }

  const trackedDeletes = new TrackedDeletes(trackedChanges)

  const decorations = []
  for (const change of trackedChanges.asSorted()) {
    const from = trackedDeletes.toCodeMirror(change.range.pos)
    if (change.tracking.type === 'insert') {
      const to = trackedDeletes.toCodeMirror(change.range.end)
      if (from < to) {
        decorations.push(
          Decoration.mark({
            class: 'ol-cm-change ol-cm-change-i',
            tracking: change.tracking,
            rangeType: 'trackedChange',
            change,
          }).range(from, to)
        )
      }
    } else {
      decorations.push(
        Decoration.widget({
          widget: new ChangeDeletedWidget(),
          side: 1,
          rangeType: 'trackedChange',
          change,
        }).range(from)
      )
    }
  }

  for (const comment of comments) {
    if (!comment.resolved) {
      for (const range of comment.ranges) {
        decorations.push(
          Decoration.mark({
            class: 'ol-cm-change ol-cm-change-c',
            id: comment.id,
            rangeType: 'comment',
            comment,
          }).range(
            trackedDeletes.toCodeMirror(range.pos),
            trackedDeletes.toCodeMirror(range.end)
          )
        )
      }
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

export const rangesState = StateField.define<{
  comments: CommentList
  trackedChanges: TrackedChangeList
  decorations: DecorationSet
}>({
  create() {
    const trackedChanges = new TrackedChangeList([])
    const comments = new CommentList([])
    const decorations = buildRangesDecorations({ trackedChanges, comments })
    return { trackedChanges, comments, decorations }
  },

  update(value, transaction) {
    const shareDoc = transaction.state.field(shareDocState)!
    const { snapshot } = shareDoc

    if (transaction.docChanged) {
      const trackedChanges = snapshot.getTrackedChanges()
      const comments = snapshot.getComments()
      const decorations = buildRangesDecorations({ trackedChanges, comments })
      value = { trackedChanges, comments, decorations }
    } else {
      for (const effect of transaction.effects) {
        if (effect.is(rangesUpdatedEffect)) {
          const trackedChanges = snapshot.getTrackedChanges()
          const comments = snapshot.getComments()
          const decorations = buildRangesDecorations({
            trackedChanges,
            comments,
          })
          value = { trackedChanges, comments, decorations }
          shareDoc.emit('ranges:dirty')
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

const updateSender = EditorState.transactionExtender.of(tr => {
  if (!tr.docChanged || tr.annotation(Transaction.remote)) {
    return {}
  }

  const trackingUserId = tr.startState.field(trackChangesUserIdState)
  const trackedDeletes = trackedDeletesFromState(tr.startState)
  const startDoc = tr.startState.doc
  const opBuilder = new OperationBuilder(
    trackedDeletes.toSnapshot(startDoc.length)
  )

  if (trackingUserId == null) {
    // Not tracking changes
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      // insert
      if (inserted.length > 0) {
        const pos = trackedDeletes.toSnapshot(fromA)
        opBuilder.insert(pos, inserted.toString())
      }

      // deletion
      if (toA > fromA) {
        const start = trackedDeletes.toSnapshot(fromA)
        const end = trackedDeletes.toSnapshot(toA)
        opBuilder.delete(start, end - start)
      }
    })
  } else {
    // Tracking changes
    const timestamp = new Date()
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      // insertion
      if (inserted.length > 0) {
        const pos = trackedDeletes.toSnapshot(fromA)
        opBuilder.trackedInsert(
          pos,
          inserted.toString(),
          trackingUserId,
          timestamp
        )
      }

      // deletion
      if (toA > fromA) {
        const start = trackedDeletes.toSnapshot(fromA)
        const end = trackedDeletes.toSnapshot(toA)
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
