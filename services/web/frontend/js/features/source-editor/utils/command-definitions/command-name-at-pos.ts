import { EditorState } from '@codemirror/state'
import { SyntaxNode } from '@lezer/common'
import { syntaxTree } from '@codemirror/language'

/**
 * Resolve the control sequence (e.g. `\mycmd`) at a document position, or null
 * if the position is not on a command. Walks up from the innermost node to the
 * nearest control-sequence node, mirroring the command-usage
 * logic in tree-operations/commands.ts. Control symbols (e.g. `\\`, `\%`) are
 * excluded: they are also in the `$CtrlSeq` group, but are never user-defined
 * commands.
 */
export function commandNameAtPos(
  state: EditorState,
  pos: number
): string | null {
  const tree = syntaxTree(state)
  // Bias right (as resolveCommandNode does) so a click on the command's first
  // character resolves into it rather than the preceding token.
  let node: SyntaxNode | null = tree.resolveInner(pos, 1)
  for (; node; node = node.parent) {
    if (node.type.is('$CtrlSeq') && !node.type.is('$CtrlSym')) {
      const name = state.sliceDoc(node.from, node.to)
      return name.length > 0 ? name : null
    }
  }
  return null
}
