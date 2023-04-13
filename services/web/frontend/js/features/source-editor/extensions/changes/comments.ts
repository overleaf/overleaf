import { Range, RangeSet, RangeValue, Transaction } from '@codemirror/state'
import { CurrentDoc } from '../../../../../../types/current-doc'
import {
  AnyOperation,
  Change,
  ChangeOperation,
  CommentOperation,
} from '../../../../../../types/change'

export type StoredComment = {
  text: string
  comments: {
    offset: number
    text: string
    comment: Change<CommentOperation>
  }[]
}

/**
 * Find tracked comments within the range of the current transaction's changes
 */
export const findCommentsInCut = (
  currentDoc: CurrentDoc,
  transaction: Transaction
) => {
  const items: StoredComment[] = []

  transaction.changes.iterChanges((fromA, toA) => {
    const comments = currentDoc.ranges.comments
      .filter(
        comment =>
          fromA <= comment.op.p && comment.op.p + comment.op.c.length <= toA
      )
      .map(comment => ({
        offset: comment.op.p - fromA,
        text: comment.op.c,
        comment,
      }))

    if (comments.length) {
      items.push({
        text: transaction.startState.sliceDoc(fromA, toA),
        comments,
      })
    }
  })

  return items
}

/**
 * Find stored comments matching the text of the current transaction's changes
 */
export const findCommentsInPaste = (
  storedComments: StoredComment[],
  transaction: Transaction
) => {
  const ops: ChangeOperation[] = []

  transaction.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    const insertedText = inserted.toString()

    // note: only using the first match
    const matchedComment = storedComments.find(
      item => item.text === insertedText
    )

    if (matchedComment) {
      for (const { offset, text, comment } of matchedComment.comments) {
        // Resubmitting an existing comment op (by thread id) will move it
        ops.push({
          c: text,
          p: fromB + offset,
          t: comment.id,
        })
      }
    }
  })

  return ops
}

class CommentRangeValue extends RangeValue {
  constructor(
    public content: string,
    public comment: Change<CommentOperation>
  ) {
    super()
  }
}

/**
 * Find tracked comments with no content with the ranges of a transaction's changes
 */
export const findDetachedCommentsInChanges = (
  currentDoc: CurrentDoc,
  transaction: Transaction
) => {
  const items: Range<CommentRangeValue>[] = []

  transaction.changes.iterChanges((fromA, toA) => {
    for (const comment of currentDoc.ranges.comments) {
      const content = comment.op.c

      // TODO: handle comments that were never attached
      if (!content.length) {
        continue
      }

      const from = comment.op.p
      const to = from + content.length

      if (fromA <= from && to <= toA) {
        items.push(new CommentRangeValue(content, comment).range(from, to))
      }
    }
  })

  return RangeSet.of(items, true)
}

/**
 * Submit operations to the ShareJS doc
 * (used when restoring comments on paste)
 */
const submitOps = (
  currentDoc: CurrentDoc,
  ops: AnyOperation[],
  transaction: Transaction
) => {
  for (const op of ops) {
    currentDoc.submitOp(op)
  }

  // Check that comments still match text. Will throw error if not.
  currentDoc.ranges.validate(transaction.state.doc.toString())
}

/**
 * Wait for the ShareJS doc to fire an event, then submit the operations.
 */
const submitOpsAfterEvent = (
  currentDoc: CurrentDoc,
  eventName: string,
  ops: AnyOperation[],
  transaction: Transaction
) => {
  // We have to wait until the change has been processed by the range
  // tracker, since if we move the ops into place beforehand, they will be
  // moved again when the changes are processed by the range tracker. This
  // ranges:dirty event is fired after the doc has applied the changes to
  // the range tracker.
  // TODO: could put this in an update listener instead, if the ShareJS doc has been updated by then?
  currentDoc.on(eventName, () => {
    currentDoc.off(eventName)
    submitOps(currentDoc, ops, transaction)
  })
}

/**
 * Look through the comments stored on cut, and restore those in text that matches the pasted text.
 */
export const restoreCommentsOnPaste = (
  currentDoc: CurrentDoc,
  transaction: Transaction,
  storedComments: StoredComment[]
) => {
  if (storedComments.length) {
    const ops = findCommentsInPaste(storedComments, transaction)

    if (ops.length) {
      submitOpsAfterEvent(
        currentDoc,
        'ranges:dirty.paste-cm6',
        ops,
        transaction
      )
    }
  }
}

/**
 * When undoing a change, find comments from the original content and restore them.
 */
export const restoreDetachedComments = (
  currentDoc: CurrentDoc,
  transaction: Transaction,
  storedComments: RangeSet<any>
) => {
  const ops: ChangeOperation[] = []

  const cursor = storedComments.iter()

  while (cursor.value) {
    const { id } = cursor.value.comment

    const comment = currentDoc.ranges.comments.find(item => item.id === id)

    // check that the comment still exists and is detached
    if (comment && comment.op.c === '') {
      const content = transaction.state.doc.sliceString(
        cursor.from,
        cursor.from + cursor.value.content.length
      )

      if (cursor.value.content === content) {
        ops.push({
          c: cursor.value.content,
          p: cursor.from,
          t: id,
        })
      }
    }

    cursor.next()
  }

  // FIXME: timing issue with rapid undos
  if (ops.length) {
    window.setTimeout(() => {
      submitOps(currentDoc, ops, transaction)
    }, 0)
  }

  // submitOpsAfterEvent('ranges:dirty.undo-cm6', ops, transaction)
}
