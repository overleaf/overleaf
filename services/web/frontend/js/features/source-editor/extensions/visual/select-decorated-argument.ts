import {
  EditorSelection,
  EditorState,
  SelectionRange,
  StateField,
} from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Tree } from '@lezer/common'
import {
  ancestorOfNodeWithType,
  descendantsOfNodeWithType,
} from '../../utils/tree-operations/ancestors'
import { getMousedownSelection, selectionIntersects } from './selection'
import { DecorationSet } from '@codemirror/view'

/**
 * A custom extension that updates the selection in a transaction if the mouse pointer was used
 * to position a cursor at the start or end of an argument (the cursor is placed inside the brace),
 * or to drag a range across the whole range of an argument (the selection is placed inside the braces),
 * when the selection was not already inside the command.
 */
export const selectDecoratedArgument = (
  field: StateField<{ decorations: DecorationSet }>
) =>
  EditorState.transactionFilter.of(tr => {
    if (tr.selection && tr.isUserEvent('select.pointer')) {
      const tree = syntaxTree(tr.state)
      let selection = tr.selection
      const mousedownSelection = getMousedownSelection(tr.state)
      let replaced = false
      const rangeSet = tr.state.field(field, false)?.decorations
      for (const [index, range] of selection.ranges.entries()) {
        if (rangeSet) {
          let isAtomicRange = false
          rangeSet.between(range.anchor, range.anchor, (_from, to) => {
            if (to > range.anchor) {
              isAtomicRange = true
              return false
            }
          })

          if (isAtomicRange === false) {
            // skip since decoration is not covering the selection
            continue
          }
        }

        const replacementRange =
          selectArgument(tree, range, mousedownSelection, 1) ||
          selectArgument(tree, range, mousedownSelection, -1)
        if (replacementRange) {
          selection = selection.replaceRange(replacementRange, index)
          replaced = true
        }
      }
      if (replaced) {
        return [tr, { selection }]
      }
    }

    return tr
  })

const selectArgument = (
  tree: Tree,
  range: SelectionRange,
  mousedownSelection: EditorSelection | undefined,
  side: -1 | 1
): SelectionRange | undefined => {
  const anchor = tree.resolveInner(range.anchor, side)

  const ancestorCommand = ancestorOfNodeWithType(anchor, '$Command')
  if (!ancestorCommand) {
    return
  }

  const mousedownSelectionInside =
    mousedownSelection !== undefined &&
    selectionIntersects(mousedownSelection, ancestorCommand)
  if (mousedownSelectionInside) {
    return
  }

  const [inner] = descendantsOfNodeWithType(ancestorCommand, '$TextArgument')
  if (!inner) {
    return
  }

  if (side === 1) {
    if (
      range.anchor === inner.from + 1 ||
      range.anchor === ancestorCommand.from
    ) {
      if (range.empty) {
        // selecting at the start
        return EditorSelection.cursor(inner.from + 1)
      } else if (Math.abs(range.head - inner.to) < 2) {
        // selecting from the start to the end
        return EditorSelection.range(inner.from + 1, inner.to - 1)
      }
    }
  } else {
    if (range.anchor === inner.to - 1 || range.anchor === ancestorCommand.to) {
      if (range.empty) {
        // selecting at the end
        return EditorSelection.cursor(inner.to - 1)
      } else if (Math.abs(range.head - ancestorCommand.from) < 2) {
        // selecting from the end to the start
        return EditorSelection.range(inner.to - 1, inner.from + 1)
      }
    }
  }
}
