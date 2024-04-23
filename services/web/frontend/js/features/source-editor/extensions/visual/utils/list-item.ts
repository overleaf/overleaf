import { EditorState } from '@codemirror/state'
import {
  getIndentation,
  IndentContext,
  indentString,
} from '@codemirror/language'

export const createListItem = (state: EditorState, pos: number) => {
  const cx = new IndentContext(state)
  const columns = getIndentation(cx, pos) ?? 0
  const indent = indentString(state, columns)
  return `${indent}\\item `
}
