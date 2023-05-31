/**
 * Adapted from CodeMirror 6 (@codemirror/autocomplete), licensed under the MIT license:
 * https://github.com/codemirror/autocomplete/blob/08f63add9f470a032d3802a4599caa86c75de5cb/src/snippet.ts#L29-L45
 */

import { indentUnit } from '@codemirror/language'
import { EditorState } from '@codemirror/state'

// apply correct indentation to passed lines
export function prepareLines(
  lines: (string | null)[],
  state: EditorState,
  pos: number
) {
  const text = []
  const lineStart = [pos]
  const lineObj = state.doc.lineAt(pos)
  const baseIndent = /^\s*/.exec(lineObj.text)![0]
  for (let line of lines) {
    if (line === null) continue
    if (text.length) {
      let indent = baseIndent
      const tabs = /^\t*/.exec(line)![0].length
      for (let i = 0; i < tabs; i++) indent += state.facet(indentUnit)
      lineStart.push(pos + indent.length - tabs)
      line = indent + line.slice(tabs)
    }
    text.push(line)
    pos += line.length + 1
  }

  return text.join('\n')
}
