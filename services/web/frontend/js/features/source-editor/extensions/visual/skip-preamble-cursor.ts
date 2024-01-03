import { DecorationSet, EditorView, ViewPlugin } from '@codemirror/view'
import {
  EditorSelection,
  EditorState,
  RangeSet,
  StateField,
} from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { collapsePreambleEffect, Preamble } from './visual-widgets/preamble'
/**
 * A view plugin that moves the cursor from the start of the preamble into the document body when the doc is opened.
 */
export const skipPreambleWithCursor = (
  field: StateField<{ preamble: Preamble; decorations: DecorationSet }>
) =>
  ViewPlugin.define((view: EditorView) => {
    let checkedOnce = false

    const escapeFromAtomicRanges = (
      selection: EditorSelection,
      force = false
    ) => {
      const originalSelection = selection

      const atomicRangeSets = view.state
        .facet(EditorView.atomicRanges)
        .map(item => item(view))

      for (const [index, range] of selection.ranges.entries()) {
        const anchor = skipAtomicRanges(
          view.state,
          atomicRangeSets,
          range.anchor
        )
        const head = skipAtomicRanges(view.state, atomicRangeSets, range.head)

        if (anchor !== range.anchor || head !== range.head) {
          selection = selection.replaceRange(
            EditorSelection.range(anchor, head),
            index
          )
        }
      }

      if (force || selection !== originalSelection) {
        // TODO: needs to happen after cursor position is restored?
        window.setTimeout(() => {
          view.dispatch({
            selection,
            scrollIntoView: true,
          })
        })
      }
    }

    const escapeFromPreamble = () => {
      const preamble = view.state.field(field, false)?.preamble
      if (preamble) {
        escapeFromAtomicRanges(
          EditorSelection.create([EditorSelection.cursor(preamble.to + 1)]),
          true
        )
      }
    }

    return {
      update(update) {
        if (checkedOnce) {
          if (
            update.transactions.some(tr =>
              tr.effects.some(effect => effect.is(collapsePreambleEffect))
            )
          ) {
            escapeFromPreamble()
          }
        } else {
          const { state } = update

          if (syntaxTree(state).length === state.doc.length) {
            checkedOnce = true

            // Only move the cursor if we're at the default position (0). Otherwise
            // switching back and forth between source/RT while editing the preamble
            // would be annoying.
            if (
              state.selection.eq(
                EditorSelection.create([EditorSelection.cursor(0)])
              )
            ) {
              escapeFromPreamble()
            } else {
              escapeFromAtomicRanges(state.selection)
            }
          }
        }
      },
    }
  })

const skipAtomicRanges = (
  state: EditorState,
  rangeSets: RangeSet<any>[],
  pos: number
) => {
  let oldPos
  do {
    oldPos = pos

    for (const rangeSet of rangeSets) {
      rangeSet.between(pos, pos, (_from, to) => {
        if (to > pos) {
          pos = to
        }
      })
    }

    // move from the end of a line to the start of the next line
    if (pos !== oldPos && state.doc.lineAt(pos).to === pos) {
      pos++
    }
  } while (pos !== oldPos)

  return Math.min(pos, state.doc.length)
}
