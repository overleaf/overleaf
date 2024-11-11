import { EditorState } from '@codemirror/state'
import { IndentContext, indentString } from '@codemirror/language'

export const createListItem = (state: EditorState, pos: number) => {
  const cx = new IndentContext(state)
  const columns = cx.lineIndent(pos)
  const indent = indentString(state, columns)
  return `${indent}\\item `
}
