import {
  EditorSelection,
  EditorState,
  SelectionRange,
  Transaction,
} from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { SyntaxNode } from '@lezer/common'

/**
 * A transaction filter which modifies a transaction if it places the cursor in front of a list item marker,
 * to ensure that the cursor is positioned after the marker.
 */
export const listItemMarker = EditorState.transactionFilter.of(tr => {
  if (tr.selection) {
    let selection = tr.selection
    for (const [index, range] of tr.selection.ranges.entries()) {
      if (range.empty) {
        const node = syntaxTree(tr.state).resolveInner(range.anchor, 1)
        const pos = chooseTargetPosition(node, tr, range, index)
        if (pos !== null) {
          selection = selection.replaceRange(
            EditorSelection.cursor(
              pos,
              range.assoc,
              range.bidiLevel ?? undefined, // workaround for inconsistent types
              range.goalColumn
            ),
            index
          )
        }
      }
    }
    if (selection !== tr.selection) {
      return [tr, { selection }]
    }
  }
  return tr
})

const chooseTargetPosition = (
  node: SyntaxNode,
  tr: Transaction,
  range: SelectionRange,
  index: number
) => {
  let targetNode
  if (node.type.is('Item')) {
    targetNode = node
  } else if (node.type.is('ItemCtrlSeq')) {
    targetNode = node.parent
  } else if (
    node.type.is('Whitespace') &&
    node.nextSibling?.type.is('Command')
  ) {
    targetNode = node.nextSibling?.firstChild?.firstChild
  }

  if (!targetNode?.type.is('Item')) {
    return null
  }

  // mouse click
  if (tr.isUserEvent('select.pointer')) {
    // jump to after the item
    return targetNode.to
  }

  const previousHead = tr.startState.selection.ranges[index]?.head

  // keyboard navigation
  if (range.head < previousHead) {
    // moving backwards: jump to end of the previous line
    return Math.max(tr.state.doc.lineAt(range.anchor).from - 1, 1)
  } else {
    // moving forwards: jump to after the item
    return targetNode.to
  }
}
