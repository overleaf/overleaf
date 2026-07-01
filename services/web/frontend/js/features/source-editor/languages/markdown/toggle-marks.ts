import { EditorView } from '@codemirror/view'
import { EditorSelection, SelectionRange } from '@codemirror/state'
import { ensureSyntaxTree } from '@codemirror/language'
import { SyntaxNode } from '@lezer/common'
import { ancestorOfNodeWithType } from '../../utils/tree-query'
import { wrapRanges } from '../../commands/ranges'

// Bold parses as `StrongEmphasis`, italic as `Emphasis`, strikethrough as
// `Strikethrough`; their delimiters are `EmphasisMark`/`StrikethroughMark`.
type InlineNodeType = 'StrongEmphasis' | 'Emphasis' | 'Strikethrough'
type DelimiterMarkType = 'EmphasisMark' | 'StrikethroughMark'

// Rebuild a range at new offsets while keeping the user's selection direction
const moveRange = (range: SelectionRange, newFrom: number, newTo: number) => {
  const forwards = range.from === range.anchor
  return forwards
    ? EditorSelection.range(newFrom, newTo)
    : EditorSelection.range(newTo, newFrom)
}

// The enclosing node of the requested type that fully contains the range, or
// null. The exact type is matched so bold, italic and strikethrough aren't
// confused with one another.
const enclosingNode = (
  view: EditorView,
  range: SelectionRange,
  nodeType: InlineNodeType
): SyntaxNode | null => {
  const tree = ensureSyntaxTree(view.state, range.to, 1000)
  if (!tree) {
    return null
  }

  // For a collapsed cursor, try both sides so a cursor touching either
  // delimiter boundary still resolves into the node rather than past it.
  const resolveEnclosing = (side: -1 | 1) =>
    ancestorOfNodeWithType(tree.resolveInner(range.from, side), nodeType)
  const enclosing = range.empty
    ? (resolveEnclosing(-1) ?? resolveEnclosing(1))
    : resolveEnclosing(1)
  if (!enclosing) {
    return null
  }

  if (range.from < enclosing.from || range.to > enclosing.to) {
    return null
  }

  return enclosing
}

const delimiterMarks = (
  node: SyntaxNode,
  markType: DelimiterMarkType
): { open: SyntaxNode; close: SyntaxNode } | null => {
  let open: SyntaxNode | null = null
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.type.is(markType)) {
      open = child
      break
    }
  }
  let close: SyntaxNode | null = null
  for (let child = node.lastChild; child; child = child.prevSibling) {
    if (child.type.is(markType)) {
      close = child
      break
    }
  }
  if (!open || !close || open === close) {
    return null
  }
  return { open, close }
}

// Delimiter ranges of same-type spans fully inside the selection, so wrapping
// can strip them and produce a single flat span instead of nested markup.
const innerMarksToStrip = (
  view: EditorView,
  range: SelectionRange,
  nodeType: InlineNodeType,
  markType: DelimiterMarkType
): { from: number; to: number }[] => {
  const result: { from: number; to: number }[] = []
  if (range.empty) {
    return result
  }
  const tree = ensureSyntaxTree(view.state, range.to, 1000)
  if (!tree) {
    return result
  }
  tree.iterate({
    from: range.from,
    to: range.to,
    enter: node => {
      if (
        node.type.is(nodeType) &&
        node.from >= range.from &&
        node.to <= range.to
      ) {
        const marks = delimiterMarks(node.node, markType)
        if (marks) {
          result.push({ from: marks.open.from, to: marks.open.to })
          result.push({ from: marks.close.from, to: marks.close.to })
        }
      }
    },
  })
  return result
}

/**
 * Toggle a markdown inline delimiter (bold, italic or strikethrough). Unwraps
 * when the cursor/selection is already inside a span of that type, flattens any
 * same-type spans contained in the selection, and otherwise wraps via
 * `wrapRanges`.
 */
export const toggleWrapRanges = (
  prefix: string,
  suffix: string,
  nodeType: InlineNodeType,
  markType: DelimiterMarkType = 'EmphasisMark'
) => {
  const wrap = wrapRanges(prefix, suffix)

  return (view: EditorView): boolean => {
    if (view.state.readOnly) {
      return false
    }

    const ranges = view.state.selection.ranges
    const needsCustom = ranges.some(
      range =>
        enclosingNode(view, range, nodeType) !== null ||
        innerMarksToStrip(view, range, nodeType, markType).length > 0
    )

    if (!needsCustom) {
      return wrap(view)
    }

    view.dispatch(
      view.state.changeByRange(range => {
        const enclosing = enclosingNode(view, range, nodeType)
        if (!enclosing) {
          // Strip any same-type spans inside the selection before wrapping so
          // the result is a single flat span rather than nested markup.
          const innerMarks = innerMarksToStrip(view, range, nodeType, markType)
          if (innerMarks.length > 0) {
            const deletedLength = innerMarks.reduce(
              (total, mark) => total + (mark.to - mark.from),
              0
            )
            return {
              range: moveRange(
                range,
                range.from + prefix.length,
                range.to + prefix.length - deletedLength
              ),
              changes: [
                { from: range.from, insert: prefix },
                ...innerMarks.map(mark => ({ from: mark.from, to: mark.to })),
                { from: range.to, insert: suffix },
              ],
            }
          }
          const content = view.state.sliceDoc(range.from, range.to)
          return {
            range: range.map(
              view.state.changes([{ from: range.from, insert: prefix }]),
              1
            ),
            changes: [
              {
                from: range.from,
                to: range.to,
                insert: `${prefix}${content}${suffix}`,
              },
            ],
          }
        }

        const marks = delimiterMarks(enclosing, markType)
        if (!marks) {
          return { range }
        }

        const { open, close } = marks
        const innerFrom = open.to
        const innerTo = close.from
        const openLength = open.to - open.from

        // Clamp the selection to the inner text, then shift left by the deleted
        // opening delimiter so it still covers the unwrapped text.
        const mapPos = (pos: number) =>
          Math.min(Math.max(pos, innerFrom), innerTo) - openLength

        return {
          range: moveRange(range, mapPos(range.from), mapPos(range.to)),
          changes: [
            { from: open.from, to: open.to },
            { from: close.from, to: close.to },
          ],
        }
      }),
      { scrollIntoView: true }
    )
    return true
  }
}
