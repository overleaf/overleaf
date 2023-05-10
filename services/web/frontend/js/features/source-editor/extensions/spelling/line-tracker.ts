import OError from '@overleaf/o-error'
import { Text } from '@codemirror/state'
import { Word } from './spellchecker'
import { ViewUpdate } from '@codemirror/view'

export class LineTracker {
  private _lines: boolean[]
  constructor(doc: Text) {
    /*
     * Maintain an array of booleans, one for each line of the document.
     * `true` means a line has changed
     */
    this._lines = new Array(doc.lines).fill(true)
  }

  dump() {
    return [...this._lines]
  }

  count() {
    return this._lines.length
  }

  lineHasChanged(lineNumber: number) {
    return this._lines[lineNumber - 1] === true
  }

  /*
   * Given a list of words, clear the 'changed' mark
   * on the lines the words are on
   */
  clearChangedLinesForWords(words: Word[]) {
    words.forEach(word => {
      this.clearLine(word.lineNumber)
    })
  }

  clearLine(lineNumber: number) {
    this._lines[lineNumber - 1] = false
  }

  clearAllLines() {
    this._lines = this._lines.map(() => false)
  }

  resetAllLines() {
    this._lines = this._lines.map(() => true)
  }

  markLineAsUpdated(lineNumber: number) {
    this._lines[lineNumber - 1] = true
  }

  /*
   * On update, for all changes, mark the affected lines
   * as changed
   */
  applyUpdate(update: ViewUpdate) {
    for (const transaction of update.transactions) {
      if (transaction.docChanged) {
        let lineShift = 0
        transaction.changes.iterChanges(
          (fromA, toA, fromB, toB, insertedText) => {
            const insertedLength = insertedText.length
            const removedLength = toA - fromA
            const hasInserted = insertedLength > 0
            const hasRemoved = removedLength > 0
            const oldDoc = transaction.startState.doc
            if (hasRemoved) {
              const startLine = oldDoc.lineAt(fromA).number
              const endLine = oldDoc.lineAt(toA).number
              /* Mark start line as changed, and remove deleted lines
               * Example:
               *   with this text:
               *   |1|aaaa|
               *   |2|bbbb|  => [false, false, false, false]
               *   |3|cccc|
               *   |4|dddd|
               *
               *   with a selection covering 'bbcccc' across lines 2 and 3,
               *   press backspace,
               *   resulting in:
               *   |1|aaaa|
               *   |2|bb|  => [false, true, false]
               *   |3|dddd|
               */
              this._lines.splice(
                startLine - 1 + lineShift,
                endLine - startLine + 1,
                true
              )
              lineShift -= endLine - startLine
            }
            if (hasInserted) {
              const startLine = oldDoc.lineAt(fromA).number
              /* Mark start line as changed, and insert new (changed) lines after.
               * Example:
               *   with this text:
               *   |1|aaaa|
               *   |2|bbbb|  => [false, false, false]
               *   |3|cccc|
               *
               *   with the cursor at the end of line 2,
               *   insert the following text:
               *   |1|xx|
               *   |2|yy|
               *
               *   results in:
               *   |1|aaaa|
               *   |2|bbbbxx|  => [false, true, true, false]
               *   |3|yy|
               *   |4|cccc|
               */
              const changes = new Array(insertedText.lines).fill(true)
              this._lines.splice(startLine - 1 + lineShift, 1, ...changes)
              lineShift += changes.length - 1
            }
          }
        )
      }
      if (update.state.doc.lines !== this._lines.length) {
        throw new OError(
          'LineTracker length does not match document line count'
        ).withInfo({
          documentLines: update.state.doc.lines,
          trackerLines: this._lines.length,
        })
      }
    }
  }
}
