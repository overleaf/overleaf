import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view'
import {
  EditorState,
  Range as CmRange,
  RangeSet,
  StateEffect,
  StateField,
  Transaction,
} from '@codemirror/state'
import {
  AddCommentOperation,
  CommentList,
  EditOperation,
  Range as OtRange,
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
import {
  CommentRangeValue,
  restoreDetachedCommentsEffect,
} from './changes/comments'

export const historyOT = (currentDoc: DocumentContainer) => {
  const trackedChanges =
    currentDoc.historyOTShareDoc.snapshot.getTrackedChanges() ??
    new TrackedChangeList([])
  const comments =
    currentDoc.historyOTShareDoc.snapshot.getComments() ?? new CommentList([])
  return [
    updateSender,
    trackChangesUserIdState,
    cutCommentsState,
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
        const from = trackedDeletes.toCodeMirror(range.pos)
        const to = trackedDeletes.toCodeMirror(range.end)
        // a range hidden inside a tracked delete has no visible text to mark
        if (from < to) {
          decorations.push(
            Decoration.mark({
              class: 'ol-cm-change ol-cm-change-c',
              id: comment.id,
              rangeType: 'comment',
              comment,
            }).range(from, to)
          )
        }
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

type CutComment = { offset: number; text: string; id: string }
type CutSpan = { text: string; comments: CutComment[] }

const cutCommentsEffect = StateEffect.define<CutSpan[]>()

// Comments captured by the latest cut, to restore onto matching pasted text.
const cutCommentsState = StateField.define<CutSpan[]>({
  create() {
    return []
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(cutCommentsEffect)) {
        return effect.value
      }
    }
    if (tr.isUserEvent('input.paste')) {
      return []
    }
    return value
  },
})

const findCutComments = (tr: Transaction): CutSpan[] => {
  // Read the comments as they were before the cut. Snapshots are copied on
  // each edit, so startState's rangesState still holds the pre-cut ranges.
  const { comments, trackedChanges } = tr.startState.field(rangesState)
  const trackedDeletes = new TrackedDeletes(trackedChanges)
  const spans: CutSpan[] = []

  tr.changes.iterChanges((fromA, toA) => {
    const captured: CutComment[] = []
    for (const comment of comments) {
      for (const range of comment.ranges) {
        const from = trackedDeletes.toCodeMirror(range.pos)
        const to = trackedDeletes.toCodeMirror(range.end)
        // Capture only a comment wholly inside the cut span; from < to skips
        // already-detached comments, and a straddling comment stays detached.
        if (from < to && fromA <= from && to <= toA) {
          captured.push({
            offset: from - fromA,
            text: tr.startState.sliceDoc(from, to),
            id: comment.id,
          })
        }
      }
    }
    if (captured.length) {
      spans.push({
        text: tr.startState.sliceDoc(fromA, toA),
        comments: captured,
      })
    }
  })

  return spans
}

export const findDetachedHistoryOTCommentsInChanges = (tr: Transaction) => {
  const { comments, trackedChanges } = tr.startState.field(rangesState)
  const trackedDeletes = new TrackedDeletes(trackedChanges)
  const items: CmRange<CommentRangeValue>[] = []

  tr.changes.iterChanges((fromA, toA) => {
    for (const comment of comments) {
      for (const range of comment.ranges) {
        const from = trackedDeletes.toCodeMirror(range.pos)
        const to = trackedDeletes.toCodeMirror(range.end)
        // Same wholly-inside-the-change capture rule as findCutComments.
        if (from < to && fromA <= from && to <= toA) {
          const content = tr.startState.sliceDoc(from, to)
          items.push(
            new CommentRangeValue(content, { id: comment.id }).range(from, to)
          )
        }
      }
    }
  })

  return RangeSet.of(items, true)
}

// Re-attach comments to text this transaction restores: cut comments onto
// matching pasted text, and comments recorded on deletion onto undone text.
// Ranges are expressed in the target document of the transaction's text op,
// so the AddCommentOperations must follow it in the same update.
const buildCommentRestoreOps = (
  tr: Transaction,
  shareDoc: HistoryOTShareDoc,
  insertions: { fromB: number; text: string; targetPos: number }[]
) => {
  const rangesByCommentId = new Map<string, OtRange[]>()

  if (tr.isUserEvent('input.paste')) {
    const cutSpans = tr.startState.field(cutCommentsState)
    for (const insertion of insertions) {
      const matched = cutSpans.find(span => span.text === insertion.text)
      if (!matched) {
        continue
      }
      // Re-adding by the same id moves the (now detached) comment here.
      for (const { offset, text, id } of matched.comments) {
        const ranges = rangesByCommentId.get(id) ?? []
        ranges.push(new OtRange(insertion.targetPos + offset, text.length))
        rangesByCommentId.set(id, ranges)
      }
    }
  }

  const snapshotComments = shareDoc.snapshot.getComments()
  for (const effect of tr.effects) {
    if (!effect.is(restoreDetachedCommentsEffect)) {
      continue
    }
    const cursor = effect.value.iter()
    while (cursor.value) {
      const { content, comment } = cursor.value
      const existing = snapshotComments.getComment(comment.id)
      // Only restore while the comment is still detached and the undo brought
      // the same text back.
      if (
        existing?.isEmpty() &&
        tr.newDoc.sliceString(cursor.from, cursor.from + content.length) ===
          content
      ) {
        const insertion = insertions.find(
          item =>
            item.fromB <= cursor.from &&
            cursor.from + content.length <= item.fromB + item.text.length
        )
        if (insertion) {
          const ranges = rangesByCommentId.get(comment.id) ?? []
          ranges.push(
            new OtRange(
              insertion.targetPos + (cursor.from - insertion.fromB),
              content.length
            )
          )
          rangesByCommentId.set(comment.id, ranges)
        }
      }
      cursor.next()
    }
  }

  // One op per id: AddCommentOperation replaces the comment entry, so a second
  // op for the same id would drop the first op's ranges, and the replacement
  // must carry the current resolved state.
  return Array.from(
    rangesByCommentId,
    ([id, ranges]) =>
      new AddCommentOperation(
        id,
        ranges,
        snapshotComments.getComment(id)?.resolved
      )
  )
}

const updateSender = EditorState.transactionExtender.of(tr => {
  if (!tr.docChanged || tr.annotation(Transaction.remote)) {
    return {}
  }

  const trackingUserId = tr.startState.field(trackChangesUserIdState)
  const trackedDeletes = trackedDeletesFromState(tr.startState)
  const startDoc = tr.startState.doc
  // Seed the builder with the full snapshot length (visible length plus all
  // tracked deletes). Mapping the CM length through toSnapshot under-counts
  // when a tracked delete sits at the end of the document.
  const opBuilder = new OperationBuilder(
    startDoc.length + trackedDeletes.totalLength
  )

  // An insert strictly inside a comment extends it, matching ShareLaTeX
  // (inserts at either edge are excluded). `pos` is in snapshot coordinates.
  // Keep the rule in step with getHistoryOpForInsert in document-updater's
  // RangesManager.
  const comments = tr.startState.field(rangesState).comments
  const commentIdsAt = (pos: number) => {
    const ids = []
    for (const comment of comments) {
      if (comment.ranges.some(range => range.pos < pos && pos < range.end)) {
        ids.push(comment.id)
      }
    }
    return ids.length > 0 ? ids : undefined
  }

  // Where each insertion lands in the built op's target document, for placing
  // restored comments in the same update.
  const insertions: { fromB: number; text: string; targetPos: number }[] = []

  if (trackingUserId == null) {
    // Not tracking changes
    tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
      // insert
      if (inserted.length > 0) {
        const pos = trackedDeletes.toSnapshot(fromA)
        const text = inserted.toString()
        const targetPos = opBuilder.insert(pos, text, commentIdsAt(pos))
        insertions.push({ fromB, text, targetPos })
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
        const text = inserted.toString()
        const targetPos = opBuilder.trackedInsert(
          pos,
          text,
          trackingUserId,
          timestamp,
          commentIdsAt(pos)
        )
        insertions.push({ fromB, text, targetPos })
      }

      // deletion
      if (toA > fromA) {
        const start = trackedDeletes.toSnapshot(fromA)
        const end = trackedDeletes.toSnapshot(toA)
        opBuilder.trackedDelete(start, end - start, trackingUserId, timestamp)
      }
    })
  }

  const shareDoc = tr.startState.field(shareDocState)
  if (shareDoc != null) {
    const ops: EditOperation[] = [opBuilder.finish()]
    for (const op of buildCommentRestoreOps(tr, shareDoc, insertions)) {
      ops.push(op)
    }
    shareDoc.submitOp(ops)
  }

  if (tr.isUserEvent('delete.cut')) {
    return { effects: cutCommentsEffect.of(findCutComments(tr)) }
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
   * Length difference between the target and source documents for the
   * operations built so far
   */
  private delta: number

  /**
   * Operation built
   */
  private op: TextOperation

  constructor(docLength: number) {
    this.docLength = docLength
    this.op = new TextOperation()
    this.pos = 0
    this.delta = 0
  }

  /**
   * Returns the position of the inserted text in the target document.
   */
  insert(pos: number, text: string, commentIds?: string[]) {
    this.retainUntil(pos)
    this.op.insert(text, { commentIds })
    const targetPos = pos + this.delta
    this.delta += text.length
    return targetPos
  }

  delete(pos: number, length: number) {
    this.retainUntil(pos)
    this.op.remove(length)
    this.pos += length
    this.delta -= length
  }

  /**
   * Returns the position of the inserted text in the target document.
   */
  trackedInsert(
    pos: number,
    text: string,
    userId: string,
    timestamp: Date,
    commentIds?: string[]
  ) {
    this.retainUntil(pos)
    this.op.insert(text, {
      tracking: new TrackingProps('insert', userId, timestamp),
      commentIds,
    })
    const targetPos = pos + this.delta
    this.delta += text.length
    return targetPos
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
