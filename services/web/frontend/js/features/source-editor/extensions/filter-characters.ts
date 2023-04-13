import { ChangeSpec, EditorState, Transaction } from '@codemirror/state'

const BAD_CHARS_REGEXP = /[\0\uD800-\uDFFF]/g
const BAD_CHARS_REPLACEMENT_CHAR = '\uFFFD'

export const filterCharacters = () => {
  return EditorState.transactionFilter.of(tr => {
    if (tr.docChanged && !tr.annotation(Transaction.remote)) {
      const changes: ChangeSpec[] = []

      tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        const text = inserted.toString()

        const newText = text.replaceAll(
          BAD_CHARS_REGEXP,
          BAD_CHARS_REPLACEMENT_CHAR
        )

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
