import { EditorView } from '@codemirror/view'
import { Positions } from '../tabular'
import { ChangeSpec } from '@codemirror/state'
import { RowSeparator } from '../utils'

/* eslint-disable no-unused-vars */
export enum BorderTheme {
  NO_BORDERS = 0,
  FULLY_BORDERED = 1,
}
/* eslint-enable no-unused-vars */
export const setBorders = (
  view: EditorView,
  theme: BorderTheme,
  positions: Positions,
  rowSeparators: RowSeparator[]
) => {
  const specification = view.state.sliceDoc(
    positions.columnDeclarations.from,
    positions.columnDeclarations.to
  )
  if (theme === BorderTheme.NO_BORDERS) {
    const removeColumnBorders = view.state.changes({
      from: positions.columnDeclarations.from,
      to: positions.columnDeclarations.to,
      insert: specification.replace(/\|/g, ''),
    })
    const removeHlines: ChangeSpec[] = []
    for (const row of positions.rowPositions) {
      for (const hline of row.hlines) {
        removeHlines.push({
          from: hline.from,
          to: hline.to,
          insert: '',
        })
      }
    }
    view.dispatch({
      changes: [removeColumnBorders, ...removeHlines],
    })
  } else if (theme === BorderTheme.FULLY_BORDERED) {
    let newSpec = '|'
    let consumingBrackets = 0
    for (const char of specification) {
      if (char === '{') {
        consumingBrackets++
      }
      if (char === '}' && consumingBrackets > 0) {
        consumingBrackets--
      }
      if (consumingBrackets) {
        newSpec += char
      }
      if (char === '|') {
        continue
      }
      newSpec += char + '|'
    }

    const insertColumns = view.state.changes({
      from: positions.columnDeclarations.from,
      to: positions.columnDeclarations.to,
      insert: newSpec,
    })

    const insertHlines: ChangeSpec[] = []
    for (const row of positions.rowPositions) {
      if (row.hlines.length === 0) {
        insertHlines.push(
          view.state.changes({
            from: row.from,
            to: row.from,
            insert: ' \\hline ',
          })
        )
      }
    }
    const lastRow = positions.rowPositions[positions.rowPositions.length - 1]
    if (lastRow.hlines.length < 2) {
      let toInsert = ' \\hline'
      if (rowSeparators.length < positions.rowPositions.length) {
        // We need a trailing \\
        toInsert = ` \\\\${toInsert}`
      }
      insertHlines.push(
        view.state.changes({
          from: lastRow.to,
          to: lastRow.to,
          insert: toInsert,
        })
      )
    }

    view.dispatch({
      changes: [insertColumns, ...insertHlines],
    })
  }
}
