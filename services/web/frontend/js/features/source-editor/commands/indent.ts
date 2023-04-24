import { EditorSelection } from '@codemirror/state'
import { getIndentUnit, indentString, indentUnit } from '@codemirror/language'
import { EditorView } from '@codemirror/view'

export const indentMore = (view: EditorView) => {
  if (view.state.readOnly) {
    return false
  }
  view.dispatch(
    view.state.changeByRange(range => {
      const doc = view.state.doc

      const changes = []

      if (range.empty) {
        // insert space(s) at the cursor
        const line = doc.lineAt(range.from)
        const unit = getIndentUnit(view.state)
        const offset = range.from - line.from
        const cols = unit - (offset % unit)
        const insert = indentString(view.state, cols)

        changes.push({ from: range.from, insert })
      } else {
        // indent selected lines
        const insert = view.state.facet(indentUnit)
        let previousLineNumber = -1
        for (let pos = range.from; pos <= range.to; pos++) {
          const line = doc.lineAt(pos)
          if (previousLineNumber === line.number) {
            continue
          }
          changes.push({ from: line.from, insert })
          previousLineNumber = line.number
        }
      }

      const changeSet = view.state.changes(changes)

      return {
        changes: changeSet,
        range: EditorSelection.range(
          changeSet.mapPos(range.anchor, 1),
          changeSet.mapPos(range.head, 1)
        ),
      }
    })
  )
  return true
}
