import { EditorState } from '@codemirror/state'
import { Change, EditOperation } from '../../../../../../types/change'
import { isDeleteOperation, isInsertOperation } from '@/utils/operations'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { trackChangesAnnotation } from '@/features/source-editor/extensions/realtime'

/**
 * Remove tracked changes from the range tracker when they're rejected,
 * and restore the original content
 */
export const rejectChanges = (
  state: EditorState,
  ranges: DocumentContainer['ranges'],
  changeIds: string[]
) => {
  const changes = ranges!.getChanges(changeIds) as Change<EditOperation>[]

  if (changes.length === 0) {
    return {}
  }

  // When doing bulk rejections, adjacent changes might interact with each other.
  // Consider an insertion with an adjacent deletion (which is a common use-case, replacing words):
  //
  //     "foo bar baz" -> "foo quux baz"
  //
  // The change above will be modeled with two ops, with the insertion going first:
  //
  //     foo quux baz
  //         |--| -> insertion of "quux", op 1, at position 4
  //             | -> deletion of "bar", op 2, pushed forward by "quux" to position 8
  //
  // When rejecting these changes at once, if the insertion is rejected first, we get unexpected
  // results. What happens is:
  //
  //     1) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
  //        starting from position 4;
  //
  //           "foo quux baz" -> "foo  baz"
  //                |--| -> 4 characters to be removed
  //
  //     2) Rejecting the deletion adds the deleted word "bar" at position 8 (i.e. it will act as if
  //        the word "quuux" was still present).
  //
  //            "foo  baz" -> "foo  bazbar"
  //                     | -> deletion of "bar" is reverted by reinserting "bar" at position 8
  //
  // While the intended result would be "foo bar baz", what we get is:
  //
  //      "foo  bazbar" (note "bar" readded at position 8)
  //
  // The issue happens because of step 1. To revert the insertion of "quux", 4 characters are deleted
  // from position 4. This includes the position where the deletion exists; when that position is
  // cleared, the RangesTracker considers that the deletion is gone and stops tracking/updating it.
  // As we still hold a reference to it, the code tries to revert it by readding the deleted text, but
  // does so at the outdated position (position 8, which was valid when "quux" was present).
  //
  // To avoid this kind of problem, we need to make sure that reverting operations doesn't affect
  // subsequent operations that come after. Reverse sorting the operations based on position will
  // achieve it; in the case above, it makes sure that the the deletion is reverted first:
  //
  //     1) Rejecting the deletion adds the deleted word "bar" at position 8
  //
  //            "foo quux baz" -> "foo quuxbar baz"
  //                                       | -> deletion of "bar" is reverted by
  //                                            reinserting "bar" at position 8
  //
  //     2) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
  //        starting from position 4 and achieves the expected result:
  //
  //           "foo quuxbar baz" -> "foo bar baz"
  //                |--| -> 4 characters to be removed

  changes.sort((a, b) => b.op.p - a.op.p)

  const changesToDispatch = changes.map(change => {
    const { op } = change

    if (isInsertOperation(op)) {
      const from = op.p
      const content = op.i
      const to = from + content.length

      const text = state.doc.sliceString(from, to)

      if (text !== content) {
        throw new Error(`Op to be removed does not match editor text`)
      }

      return { from, to, insert: '' }
    } else if (isDeleteOperation(op)) {
      return {
        from: op.p,
        to: op.p,
        insert: op.d,
      }
    } else {
      throw new Error(`unknown change type: ${JSON.stringify(change)}`)
    }
  })

  return {
    changes: changesToDispatch,
    annotations: [trackChangesAnnotation.of('reject')],
  }
}
