import { ChangeSpec, EditorState, Transaction } from '@codemirror/state'
import { isComposing, scrubBadChars } from './composition'

/**
 * A custom extension that replaces input characters in a Unicode range with a replacement character.
 *
 * Skipped while an IME composition is active: rewriting the composed range
 * mid-composition breaks the browser IME. Composed text is scrubbed once when
 * the composition ends (see `composition.ts`).
 */
export const filterCharacters = () => {
  return EditorState.transactionFilter.of(tr => {
    if (
      tr.docChanged &&
      !tr.annotation(Transaction.remote) &&
      !isComposing(tr.startState)
    ) {
      const changes: ChangeSpec[] = []

      tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const text = inserted.toString()

        const newText = scrubBadChars(text)

        if (newText !== text) {
          changes.push({
            from: fromB,
            to: toB,
            insert: newText,
          })
        }
      })

      if (changes.length) {
        return [tr, { changes, sequential: true }]
      }
    }

    return tr
  })
}
