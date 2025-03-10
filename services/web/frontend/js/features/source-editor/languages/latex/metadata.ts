import { EditorView } from '@codemirror/view'
import { Transaction, Text } from '@codemirror/state'

const metadataChangeRe = /\\(documentclass|usepackage|RequirePackage|label)\b/
const optionChangeRe = /\b(label)=/

export const metadata = () => [
  // trigger metadata reload if edited line contains metadata-related commands
  EditorView.updateListener.of(update => {
    if (update.docChanged) {
      let needsMetadataUpdate = false

      for (const transaction of update.transactions) {
        // ignore remote changes
        if (transaction.annotation(Transaction.remote)) {
          continue
        }

        transaction.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
          const docs: [Text, number, number][] = [
            [update.startState.doc, fromA, toA],
            [update.state.doc, fromB, toB],
          ]

          for (const [doc, from, to] of docs) {
            const fromLine = doc.lineAt(from).number
            const toLine = doc.lineAt(to).number

            for (const line of doc.iterLines(fromLine, toLine + 1)) {
              if (metadataChangeRe.test(line) || optionChangeRe.test(line)) {
                needsMetadataUpdate = true
                return
              }
            }
          }
        })

        if (needsMetadataUpdate) {
          window.dispatchEvent(new CustomEvent('editor:metadata-outdated'))
          break
        }
      }
    }
  }),
]
