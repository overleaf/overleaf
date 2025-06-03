import { Decoration, EditorView } from '@codemirror/view'
import {
  ChangeSpec,
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

export const historyOT = (currentDoc: DocumentContainer) => {
  const trackedChanges = currentDoc.doc?.getTrackedChanges()
  return [
    trackChangesUserIdState,
    commentsState,
    trackedChanges != null
      ? trackedChangesState.init(() =>
          buildTrackedChangesDecorations(trackedChanges)
        )
      : trackedChangesState,
    trackedChangesFilter,
    rangesTheme,
  ]
}

const rangesTheme = EditorView.theme({
  '.tracked-change-insertion': {
    backgroundColor: 'rgba(0, 255, 0, 0.2)',
  },
  '.tracked-change-deletion': {
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
  },
  '.comment': {
    backgroundColor: 'rgba(255, 255, 0, 0.2)',
  },
})

const updateTrackedChangesEffect = StateEffect.define<TrackedChangeList>()

export const updateTrackedChanges = (trackedChanges: TrackedChangeList) => {
  return {
    effects: updateTrackedChangesEffect.of(trackedChanges),
  }
}

const buildTrackedChangesDecorations = (trackedChanges: TrackedChangeList) =>
  Decoration.set(
    trackedChanges.asSorted().map(change =>
      Decoration.mark({
        class:
          change.tracking.type === 'insert'
            ? 'tracked-change-insertion'
            : 'tracked-change-deletion',
        tracking: change.tracking,
      }).range(change.range.pos, change.range.end)
    ),
    true
  )

const trackedChangesState = StateField.define({
  create() {
    return Decoration.none
  },

  update(value, transaction) {
    if (transaction.docChanged) {
      value = value.map(transaction.changes)
    }

    for (const effect of transaction.effects) {
      if (effect.is(updateTrackedChangesEffect)) {
        value = buildTrackedChangesDecorations(effect.value)
      }
    }

    return value
  },

  provide(field) {
    return EditorView.decorations.from(field)
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

const trackedChangesFilter = EditorState.transactionFilter.of(tr => {
  if (!tr.docChanged || tr.annotation(Transaction.remote)) {
    return tr
  }

  const trackingUserId = tr.startState.field(trackChangesUserIdState)
  const startDoc = tr.startState.doc
  const changes: ChangeSpec[] = []
  const opBuilder = new OperationBuilder(startDoc.length)

  if (trackingUserId == null) {
    // Not tracking changes
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      // insert
      if (inserted.length > 0) {
        opBuilder.insert(fromA, inserted.toString())
      }

      // deletion
      if (toA > fromA) {
        opBuilder.delete(fromA, toA - fromA)
      }
    })
  } else {
    // Tracking changes
    const timestamp = new Date()
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      // insertion
      if (inserted.length > 0) {
        opBuilder.trackedInsert(
          fromA,
          inserted.toString(),
          trackingUserId,
          timestamp
        )
      }

      // deletion
      if (toA > fromA) {
        const deleted = startDoc.sliceString(fromA, toA)
        // re-insert the deleted text after the inserted text
        changes.push({
          from: fromB + inserted.length,
          insert: deleted,
        })

        opBuilder.trackedDelete(fromA, toA - fromA, trackingUserId, timestamp)
      }
    })
  }

  const op = opBuilder.finish()
  return [
    tr,
    { changes, effects: historyOTOperationEffect.of([op]), sequential: true },
  ]
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
