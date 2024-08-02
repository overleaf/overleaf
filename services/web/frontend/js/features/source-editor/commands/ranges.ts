import { EditorView } from '@codemirror/view'
import { EditorSelection, EditorState, SelectionRange } from '@codemirror/state'
import {
  ensureSyntaxTree,
  foldedRanges,
  foldEffect,
  syntaxTree,
} from '@codemirror/language'
import { SyntaxNode } from '@lezer/common'
import { ancestorOfNodeWithType } from '../utils/tree-query'
import { lastAncestorAtEndPosition } from '../utils/tree-operations/ancestors'
import {
  formattingCommandMap,
  type FormattingCommand,
  type FormattingNodeType,
} from '@/features/source-editor/utils/tree-operations/formatting'

export const wrapRanges =
  (
    prefix: string,
    suffix: string,
    wrapWholeLine = false,
    selection?: (range: SelectionRange, view: EditorView) => SelectionRange
  ) =>
  (view: EditorView): boolean => {
    if (view.state.readOnly) {
      return false
    }
    view.dispatch(
      view.state.changeByRange(range => {
        const insert = { prefix, suffix }

        if (wrapWholeLine) {
          const line = view.state.doc.lineAt(range.anchor)

          if (range.empty) {
            // expand range to cover the whole line
            range = EditorSelection.range(line.from, line.to)
          }

          // add a newline at the start if needed
          if (range.from !== line.from) {
            insert.prefix = `\n${prefix}`
          }

          // add a newline at the end if needed
          if (range.to !== line.to) {
            insert.suffix = `${suffix}\n`
          }
        }

        const content = view.state.sliceDoc(range.from, range.to)

        // map through the prefix only
        const changedRange = range.map(
          view.state.changes([
            { from: range.from, insert: `${insert.prefix}` },
          ]),
          1
        )

        return {
          range: selection ? selection(changedRange, view) : changedRange,
          // create a single change, including the content
          changes: [
            {
              from: range.from,
              to: range.to,
              insert: `${insert.prefix}${content}${insert.suffix}`,
            },
          ],
        }
      }),
      { scrollIntoView: true }
    )
    return true
  }

export const changeCase =
  (upper = true) =>
  (view: EditorView) => {
    if (view.state.readOnly) {
      return false
    }
    view.dispatch(
      view.state.changeByRange(range => {
        // ignore empty ranges
        if (range.empty) {
          return { range }
        }

        const text = view.state.doc.sliceString(range.from, range.to)

        return {
          range,
          changes: [
            {
              from: range.from,
              to: range.to,
              insert: upper ? text.toUpperCase() : text.toLowerCase(),
            },
          ],
        }
      })
    )
    return true
  }

export const duplicateSelection = (view: EditorView) => {
  if (view.state.readOnly) {
    return false
  }
  const foldedRangesInDocument = foldedRanges(view.state)
  view.dispatch(
    view.state.changeByRange(range => {
      const folds: { offset: number; base: number; length: number }[] = []
      if (range.empty) {
        const line = view.state.doc.lineAt(range.from)
        let lineStart = line.from
        let lineEnd = line.to

        // Calculate line start/end including folded ranges
        //
        // Note that at each iteration of the while loop, new folded ranges
        // can be included. This happens when there are multiple folded ranges
        // on a single editor line (but spanning multiple actual lines)
        //
        // For example, the following document:
        //  1: \begin{document}
        //  2:     test
        //  3: \end{document}\begin{document}
        //  4:     test
        //  5: \end{document}
        //
        // Can be folded to:
        //  \begin{document}<...>\end{document}\begin{document}<...>\end{document}
        //
        // In this case, the first iterations of the while loop below will only
        // include lines 3-5, since the overlapping folded range for line 5
        // is only the fold on lines 3-5. Hence in the while loop, we expand the
        // selection until we include all the ranges.
        let changed
        do {
          changed = false
          foldedRangesInDocument.between(lineStart, lineEnd, (from, to) => {
            const newLineStart = Math.min(
              view.state.doc.lineAt(from).from,
              lineStart
            )
            const newLineEnd = Math.max(view.state.doc.lineAt(to).to, lineEnd)
            if (newLineStart !== lineStart || newLineEnd !== lineEnd) {
              changed = true
              lineStart = newLineStart
              lineEnd = newLineEnd
            }
          })
        } while (changed)

        // Collect information needed to fold duplicated lines
        foldedRangesInDocument.between(lineStart, lineEnd, (from, to) => {
          folds.push({
            offset: from - lineStart,
            base: lineEnd + view.state.lineBreak.length,
            length: to - from,
          })
        })

        // Duplicate the selected lines downwards
        return {
          range,
          changes: [
            {
              from: lineEnd,
              insert:
                view.state.lineBreak + view.state.doc.slice(lineStart, lineEnd),
            },
          ],
          // Add a fold effect for each fold in the original line
          effects: folds.map(fold =>
            foldEffect.of({
              from: fold.base + fold.offset,
              to: fold.base + fold.offset + fold.length,
            })
          ),
        }
      } else {
        // Duplicate selected text at head of selection
        let newSelectionRange = range
        if (range.head > range.anchor) {
          // Duplicating to the right, so we need to update the selected range
          newSelectionRange = EditorSelection.range(
            range.head,
            range.head + (range.to - range.from)
          )
        }
        return {
          // The new range is the duplicated section, placed at the head of the
          // original selection
          range: newSelectionRange,
          changes: [
            {
              from: range.head,
              insert: view.state.doc.slice(range.from, range.to),
            },
          ],
        }
      }
    })
  )
  return true
}

const skipParentNodeTypes = [
  'LongArg',
  'TextArgument',
  'OpenBrace',
  'CloseBrace',
]

function getParentNode(
  position: number | SyntaxNode,
  state: EditorState,
  assoc: 0 | 1 | -1 = 1
): SyntaxNode | undefined {
  const tree = ensureSyntaxTree(state, 1000)
  let node: SyntaxNode | undefined | null
  if (typeof position === 'number') {
    node = tree?.resolveInner(position, assoc)?.parent

    const ancestorAtEndPos = lastAncestorAtEndPosition(node, position)
    if (ancestorAtEndPos?.parent) {
      node = ancestorAtEndPos.parent
    }
  } else {
    node = position?.parent
  }

  while (node && skipParentNodeTypes.includes(node.type.name)) {
    node = node.parent
  }

  return node || undefined
}

function wrapRangeInCommand(
  state: EditorState,
  range: SelectionRange,
  command: string
) {
  const content = state.sliceDoc(range.from, range.to)
  const changes = state.changes([
    {
      from: range.from,
      to: range.to,
      insert: `${command}{${content}}`,
    },
  ])
  return {
    changes,
    range: moveRange(
      range,
      range.from + command.length + 1,
      range.from + command.length + content.length + 1
    ),
  }
}

function moveRange(range: SelectionRange, newFrom: number, newTo: number) {
  const forwards = range.from === range.anchor
  return forwards
    ? EditorSelection.range(newFrom, newTo)
    : EditorSelection.range(newTo, newFrom)
}

function validateReplacement(expected: string, actual: string) {
  if (expected !== actual) {
    throw new Error('Replacement in toggleRange failed validation.')
  }
}

function getWrappingAncestor(
  node: SyntaxNode,
  nodeType: FormattingNodeType
): SyntaxNode | null {
  for (
    let ancestor: SyntaxNode | null = node;
    ancestor;
    ancestor = ancestor.parent
  ) {
    if (ancestor.type.is(nodeType)) {
      return ancestor
    }
    if (formattingCommandMap[ancestor.type.name as FormattingCommand]) {
      // We could multiple levels deep in bold/non-bold. So bail out in this case
      return null
    }
  }
  return null
}

function adjustRangeIfNeeded(
  nodeType: FormattingNodeType,
  range: SelectionRange,
  state: EditorState
) {
  // Try to adjust the selection, if it is either
  // 1. \textbf<{test>}
  // 2. \textbf{<test}>
  // 3. \textbf<{test}>
  // 4. <\textbf{test}>
  // 4. \textbf<>{test}
  const tree = syntaxTree(state)
  if (tree.length < range.to) {
    return range
  }

  const nodeLeft = tree.resolveInner(range.from, 1)
  const nodeRight = tree.resolveInner(range.to, -1)
  const parentLeft = getWrappingAncestor(nodeLeft, nodeType)
  const parentRight = getWrappingAncestor(nodeRight, nodeType)

  const parent = getParentNode(nodeLeft, state)
  if (
    parent?.type.is('$ToggleTextFormattingCommand') &&
    spansWholeArgument(parent, range)
  ) {
    return bubbleUpRange(
      nodeType,
      ancestorOfNodeWithType(nodeLeft, '$ToggleTextFormattingCommand'),
      range
    )
  }

  if (!parentLeft) {
    // We're not trying to unbold, so don't bother adjusting range
    return bubbleUpRange(
      nodeType,
      ancestorOfNodeWithType(nodeLeft, '$ToggleTextFormattingCommand'),
      range
    )
  }
  if (nodeLeft.type.is('$CtrlSeq') && range.from === range.to) {
    const commandNode = nodeLeft.parent?.parent?.parent
    if (!commandNode) {
      return range
    }
    return EditorSelection.cursor(commandNode.from)
  }

  let { from, to } = range
  if (nodeLeft.type.is('$CtrlSeq')) {
    from = nodeLeft.to + 1
  }
  if (nodeLeft.type.is('OpenBrace')) {
    from = nodeLeft.to
  }
  // We know that parentLeft is the $ToggleTextFormattingCommand, so now we check if we're
  // to the right of the closing brace. (parent is TextArgument, grandparent is
  // $ToggleTextFormattingCommand)
  if (parentLeft === parentRight && nodeRight.type.is('CloseBrace')) {
    to = nodeRight.from
  }
  return bubbleUpRange(nodeType, parentLeft, moveRange(range, from, to))
}

function spansWholeArgument(
  commandNode: SyntaxNode | null,
  range: SelectionRange
): boolean {
  const argument = commandNode?.getChild('TextArgument')?.getChild('LongArg')
  return Boolean(
    argument && argument.from === range.from && argument.to === range.to
  )
}

function bubbleUpRange(
  nodeType: string | number,
  node: SyntaxNode | null,
  range: SelectionRange
) {
  let currentRange = range
  for (
    let ancestorCommand: SyntaxNode | null = ancestorOfNodeWithType(
      node,
      '$ToggleTextFormattingCommand'
    );
    spansWholeArgument(ancestorCommand, currentRange);
    ancestorCommand = ancestorOfNodeWithType(
      ancestorCommand.parent,
      '$ToggleTextFormattingCommand'
    )
  ) {
    if (!ancestorCommand) {
      break
    }
    currentRange = moveRange(
      currentRange,
      ancestorCommand.from,
      ancestorCommand.to
    )
    if (ancestorCommand.type.is(nodeType)) {
      const argumentNode = ancestorCommand
        .getChild('TextArgument')
        ?.getChild('LongArg')
      if (!argumentNode) {
        return range
      }
      return moveRange(range, argumentNode.from, argumentNode.to)
    }
  }

  return range
}

export function toggleRanges(command: FormattingCommand) {
  const nodeType: FormattingNodeType = formattingCommandMap[command]

  /* There are a number of situations we need to handle in this function.
   * In the following examples, the selection range is marked within <>

   * 1. If the parent node at start and end of selection is different -> do
   *    nothing & show error. Case 8 is an exception to this.
   *      -> For good and bad, this disallows \textbf{this <is} weird
   *         \textit{to> do}
   * 2. If selection contains a BlankLine (i.e. two newlines in a row) -> do
   *    nothing & show error
   *      -> \textbf doesn't allow paragraph breaks).
   * 3. If the selection is not within a \textbf -> wrap it in a \textbf
   * 4. If selection is at the beginning of a \textbf -> shrink the \textbf
   *    command
   *      -> e.g. \textbf{<this is> a test} → <this is>\textbf{ a test}
   * 5. Similarly for selection at end of \textbf command
   * 6. If selection is in the middle of a \textbf command -> split the command
   *    into two
   *      -> e.g. \textbf{this <is a> test} → \textbf{this }<is a>\textbf{ test}
   * 7. If the selection is a whole \textbf command → remove the wrapping
   *    command.
   * 8. If the selection spans two \textbf's with the same parent then join the
   *    two
   *      -> e.g. \textbf{this <is} a \textbf{te>st} → \textbf{this <is a te>st}
   * 9. If the selection spans the end of a \textbf, into the parent of the
   *    command, then extend the \textbf.
   *      -> e.g. \textbf{this <is} a test> → \textbf{this <is a test>}
   * 10. Similarly for selections spanning the beginning of the selection
   */
  return (view: EditorView): boolean => {
    if (view.state.readOnly) {
      return false
    }
    view.dispatch(
      view.state.changeByRange(initialRange => {
        const range = adjustRangeIfNeeded(nodeType, initialRange, view.state)
        const content = view.state.sliceDoc(range.from, range.to)

        const ancestorAtStartOfRange = getParentNode(
          range.from,
          view.state,
          range.from === 0 ? 1 : -1
        )
        const ancestorAtEndOfRange = range.empty
          ? ancestorAtStartOfRange
          : getParentNode(
              range.to,
              view.state,
              range.to === view.state.doc.length ? -1 : 1
            )

        const tree = ensureSyntaxTree(view.state, 1000)
        const nodeAtFrom = tree?.resolveInner(range.from, 1)
        const nodeAtTo = tree?.resolveInner(range.to, -1)
        const isSingleNodeSelected = nodeAtFrom === nodeAtTo

        if (
          !isSingleNodeSelected &&
          ancestorAtStartOfRange !== ancestorAtEndOfRange
        ) {
          // But handle the exception of case 8
          const ancestorAtStartIsWrappingCommand =
            ancestorAtStartOfRange?.type.is(nodeType)

          const ancestorAtEndIsWrappingCommand =
            ancestorAtEndOfRange && ancestorAtEndOfRange.type.is(nodeType)

          if (
            ancestorAtStartIsWrappingCommand &&
            ancestorAtEndIsWrappingCommand &&
            ancestorAtStartOfRange?.parent?.parent?.parent &&
            ancestorAtEndOfRange?.parent?.parent?.parent
          ) {
            // Test for case 8
            const nextAncestorAtStartOfRange =
              ancestorAtStartOfRange.parent.parent.parent
            const nextAncestorAtEndOfRange =
              ancestorAtEndOfRange.parent.parent.parent

            if (nextAncestorAtStartOfRange === nextAncestorAtEndOfRange) {
              // Join the two ranges
              const textBetweenRanges = view.state.sliceDoc(
                ancestorAtStartOfRange.to,
                ancestorAtEndOfRange.from
              )
              const ancestorStartArgumentNode =
                ancestorAtStartOfRange.lastChild?.getChild('LongArg')
              const ancestorEndArgumentNode =
                ancestorAtEndOfRange.lastChild?.getChild('LongArg')
              if (!ancestorStartArgumentNode || !ancestorEndArgumentNode) {
                throw new Error("Can't find argument node")
              }
              const actualContent = view.state.sliceDoc(
                ancestorAtStartOfRange.from,
                ancestorAtEndOfRange.to
              )
              const firstCommandArgument = view.state.sliceDoc(
                ancestorStartArgumentNode.from,
                ancestorStartArgumentNode.to
              )
              const secondCommandArgument = view.state.sliceDoc(
                ancestorEndArgumentNode.from,
                ancestorEndArgumentNode.to
              )
              validateReplacement(
                `${command}{${firstCommandArgument}}${textBetweenRanges}${command}{${secondCommandArgument}}`,
                actualContent
              )
              const changes = view.state.changes([
                {
                  from: ancestorAtStartOfRange.from,
                  to: ancestorAtEndOfRange.to,
                  insert: `${command}{${firstCommandArgument}${textBetweenRanges}${secondCommandArgument}}`,
                },
              ])
              return {
                changes,
                range: moveRange(
                  range,
                  range.from,
                  range.to - command.length - 1 - 1
                ),
              }
            }
          }

          if (
            ancestorAtEndIsWrappingCommand &&
            ancestorAtEndOfRange.parent?.parent?.parent ===
              ancestorAtStartOfRange
          ) {
            // Extend to the left. Case 10
            const contentUpToCommand = view.state.sliceDoc(
              range.from,
              ancestorAtEndOfRange.from
            )
            const ancestorEndArgumentNode =
              ancestorAtEndOfRange.lastChild?.getChild('LongArg')
            if (!ancestorEndArgumentNode) {
              throw new Error("Can't find argument node")
            }
            const commandContent = view.state.sliceDoc(
              ancestorEndArgumentNode.from,
              ancestorEndArgumentNode.to
            )
            const actualContent = view.state.sliceDoc(
              range.from,
              ancestorAtEndOfRange.to
            )
            validateReplacement(
              `${contentUpToCommand}${command}{${commandContent}}`,
              actualContent
            )
            const changes = view.state.changes([
              {
                from: range.from,
                to: ancestorAtEndOfRange.to,
                insert: `${command}{${contentUpToCommand}${commandContent}}`,
              },
            ])
            return {
              changes,
              range: moveRange(
                range,
                range.from + command.length + 1,
                range.to
              ),
            }
          }

          if (
            ancestorAtStartIsWrappingCommand &&
            ancestorAtStartOfRange &&
            ancestorAtStartOfRange.parent?.parent?.parent ===
              ancestorAtEndOfRange
          ) {
            // Extend to the right. Case 9
            const contentAfterCommand = view.state.sliceDoc(
              ancestorAtStartOfRange.to,
              range.to
            )
            const ancestorStartArgumentNode =
              ancestorAtStartOfRange.lastChild?.getChild('LongArg')
            if (!ancestorStartArgumentNode) {
              throw new Error("Can't find argument node")
            }
            const commandContent = view.state.sliceDoc(
              ancestorStartArgumentNode.from,
              ancestorStartArgumentNode.to
            )
            const actualContent = view.state.sliceDoc(
              ancestorAtStartOfRange.from,
              range.to
            )
            validateReplacement(
              `${command}{${commandContent}}${contentAfterCommand}`,
              actualContent
            )
            const changes = view.state.changes([
              {
                from: ancestorAtStartOfRange.from,
                to: range.to,
                insert: `${command}{${commandContent}${contentAfterCommand}}`,
              },
            ])
            return {
              changes,
              range: moveRange(range, range.from, range.to - 1),
            }
          }
          // Bail out in case 1
          // TODO: signal error to the user
          return { range }
        }

        const ancestor = ancestorAtStartOfRange

        // Bail out in case 2
        if (content.includes('\n\n')) {
          // TODO: signal error to the user
          return { range }
        }

        const isCursorBeforeAncestor =
          range.empty &&
          ancestor &&
          range.from === ancestor.from &&
          ancestor.type.is(nodeType)

        // If we can't find an ancestor node, or if the parent is not an exsting
        // \textbf, then we just wrap it in a range. Case 3.
        if (isCursorBeforeAncestor || !ancestor?.type.is(nodeType)) {
          return wrapRangeInCommand(view.state, range, command)
        }

        const argumentNode = ancestor.lastChild?.getChild('LongArg')
        if (!argumentNode) {
          throw new Error("Can't find argument node")
        }

        // We should trim from the beginning. Case 4
        if (range.from === argumentNode.from && range.to !== argumentNode.to) {
          const textAfterSelection = view.state.sliceDoc(
            range.to,
            argumentNode.to
          )
          const wholeCommand = view.state.sliceDoc(ancestor.from, ancestor.to)
          validateReplacement(
            `${command}{${content}${textAfterSelection}}`,
            wholeCommand
          )
          const changes = view.state.changes([
            {
              from: ancestor.from,
              to: ancestor.to,
              insert: `${content}${command}{${textAfterSelection}}`,
            },
          ])
          return {
            range: moveRange(
              range,
              range.from - command.length - 1,
              range.to - command.length - 1
            ),
            changes,
          }
        }

        // We should trim from the end. Case 5
        if (range.to === argumentNode.to && range.from !== argumentNode.from) {
          const textBeforeSelection = view.state.sliceDoc(
            ancestor.from,
            range.from
          )
          const wholeCommand = view.state.sliceDoc(ancestor.from, ancestor.to)
          validateReplacement(`${textBeforeSelection}${content}}`, wholeCommand)
          const changes = view.state.changes([
            {
              from: ancestor.from,
              to: ancestor.to,
              insert: `${textBeforeSelection}}${content}`,
            },
          ])
          // We should shift selection forward by the } we insert
          return {
            range: moveRange(range, range.from + 1, range.to + 1),
            changes,
          }
        }

        // We should split the command in two. Case 6
        if (range.from !== argumentNode.from && range.to !== argumentNode.to) {
          const textBeforeSelection = view.state.sliceDoc(
            ancestor.from,
            range.from
          )
          const textAfterSelection = view.state.sliceDoc(range.to, ancestor.to)
          const wholeCommand = view.state.sliceDoc(ancestor.from, ancestor.to)
          validateReplacement(
            `${textBeforeSelection}${content}${textAfterSelection}`,
            wholeCommand
          )
          const changes = view.state.changes([
            {
              from: ancestor.from,
              to: ancestor.to,
              insert: `${textBeforeSelection}}${content}${command}{${textAfterSelection}`,
            },
          ])

          return {
            range: moveRange(range, range.from + 1, range.to + 1),
            changes,
          }
        }

        // Remove the wrapping command. Case 7
        if (spansWholeArgument(ancestor, range)) {
          const argumentContent = view.state.sliceDoc(
            argumentNode.from,
            argumentNode.to
          )
          const wholeCommand = view.state.sliceDoc(ancestor.from, ancestor.to)
          validateReplacement(`${command}{${content}}`, wholeCommand)
          const changes = view.state.changes([
            { from: ancestor.from, to: ancestor.to, insert: argumentContent },
          ])

          return {
            range: moveRange(
              range,
              range.from - command.length - 1,
              range.to - command.length - 1
            ),
            changes,
          }
        }

        // Shouldn't happen, but default to just wrapping the content
        return wrapRangeInCommand(view.state, range, command)
      }),
      { scrollIntoView: true }
    )
    return true
  }
}
