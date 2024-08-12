import {
  EditorState,
  RangeSet,
  StateEffect,
  StateField,
  Transaction,
  TransactionSpec,
} from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type PluginValue,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import {
  findCommentsInCut,
  findDetachedCommentsInChanges,
  restoreCommentsOnPaste,
  restoreDetachedComments,
  StoredComment,
} from './changes/comments'
import { invertedEffects } from '@codemirror/commands'
import {
  Change,
  DeleteOperation,
  EditOperation,
} from '../../../../../types/change'
import { ChangeManager } from './changes/change-manager'
import { debugConsole } from '@/utils/debugging'
import {
  isCommentOperation,
  isDeleteOperation,
  isInsertOperation,
} from '@/utils/operations'
import {
  DocumentContainer,
  RangesTrackerWithResolvedThreadIds,
} from '@/features/ide-react/editor/document-container'
import { trackChangesAnnotation } from '@/features/source-editor/extensions/realtime'
import { Ranges } from '@/features/review-panel-new/context/ranges-context'
import { Threads } from '@/features/review-panel-new/context/threads-context'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

type RangesData = {
  ranges: Ranges
  threads: Threads
}

const updateRangesEffect = StateEffect.define<RangesData>()

export const updateRanges = (data: RangesData): TransactionSpec => {
  return {
    effects: updateRangesEffect.of(data),
  }
}

const clearChangesEffect = StateEffect.define()
const buildChangesEffect = StateEffect.define()
const restoreDetachedCommentsEffect = StateEffect.define<RangeSet<any>>({
  map: (value, mapping) => {
    return value
      .update({
        filter: (from, to) => {
          return from <= mapping.length && to <= mapping.length
        },
      })
      .map(mapping)
  },
})

type Options = {
  currentDoc: DocumentContainer
  loadingThreads?: boolean
  ranges?: Ranges
  threads?: Threads
}

/**
 * A custom extension that initialises the change manager, passes any updates to it,
 * and produces decorations for tracked changes and comments.
 */
export const trackChanges = (
  { currentDoc, loadingThreads, ranges, threads }: Options,
  changeManager?: ChangeManager
) => {
  // A state field that stored any comments found within the ranges of a "cut" transaction,
  // to be restored when pasting matching text.
  const cutCommentsState = StateField.define<StoredComment[]>({
    create: () => {
      return []
    },
    update: (value, transaction) => {
      if (transaction.annotation(Transaction.remote)) {
        return value
      }

      if (!transaction.docChanged) {
        return value
      }

      if (transaction.isUserEvent('delete.cut')) {
        return findCommentsInCut(currentDoc, transaction)
      }

      if (transaction.isUserEvent('input.paste')) {
        restoreCommentsOnPaste(currentDoc, transaction, value)
        return []
      }

      return value
    },
  })

  return [
    // attach any comments detached by the transaction as an inverted effect, to be applied on undo
    invertedEffects.of(transaction => {
      if (
        transaction.docChanged &&
        !transaction.annotation(Transaction.remote)
      ) {
        const detachedComments = findDetachedCommentsInChanges(
          currentDoc,
          transaction
        )
        if (detachedComments.size) {
          return [restoreDetachedCommentsEffect.of(detachedComments)]
        }
      }
      return []
    }),

    // restore any detached comments on undo
    EditorState.transactionExtender.of(transaction => {
      for (const effect of transaction.effects) {
        if (effect.is(restoreDetachedCommentsEffect)) {
          // send the comments to the ShareJS doc
          restoreDetachedComments(currentDoc, transaction, effect.value)

          // return a transaction spec to rebuild the change markers
          return buildChangeMarkers()
        }
      }
      return null
    }),

    cutCommentsState,

    // initialize/destroy the change manager, and handle any updates
    changeManager
      ? ViewPlugin.define(() => {
          changeManager.initialize()

          return {
            update: update => {
              changeManager.handleUpdate(update)
            },
            destroy: () => {
              changeManager.destroy()
            },
          }
        })
      : [],

    // draw change decorations
    ViewPlugin.define<
      PluginValue & {
        decorations: DecorationSet
      }
    >(
      () => {
        let decorations = Decoration.none
        if (isSplitTestEnabled('review-panel-redesign')) {
          if (ranges && threads) {
            decorations = buildChangeDecorations(currentDoc, {
              ranges,
              threads,
            })
          }
        } else if (!loadingThreads) {
          decorations = buildChangeDecorations(currentDoc)
        }

        return {
          decorations,
          update(update) {
            for (const transaction of update.transactions) {
              this.decorations = this.decorations.map(transaction.changes)

              for (const effect of transaction.effects) {
                if (effect.is(clearChangesEffect)) {
                  this.decorations = Decoration.none
                } else if (effect.is(buildChangesEffect)) {
                  this.decorations = buildChangeDecorations(currentDoc)
                } else if (effect.is(updateRangesEffect)) {
                  this.decorations = buildChangeDecorations(
                    currentDoc,
                    effect.value
                  )
                }
              }
            }
          },
        }
      },
      {
        decorations: value => value.decorations,
      }
    ),

    // styles for change decorations
    trackChangesTheme,
  ]
}

export const clearChangeMarkers = () => {
  return {
    effects: clearChangesEffect.of(null),
  }
}

export const buildChangeMarkers = () => {
  return {
    effects: buildChangesEffect.of(null),
  }
}

const buildChangeDecorations = (
  currentDoc: DocumentContainer,
  data?: RangesData
) => {
  const ranges = data ? data.ranges : currentDoc.ranges

  if (!ranges) {
    return Decoration.none
  }

  const changes = [...ranges.changes, ...ranges.comments]

  const decorations = []

  for (const change of changes) {
    try {
      decorations.push(...createChangeRange(change, currentDoc, data))
    } catch (error) {
      // ignore invalid changes
      debugConsole.debug('invalid change position', error)
    }
  }

  return Decoration.set(decorations, true)
}

class ChangeDeletedWidget extends WidgetType {
  constructor(public change: Change<DeleteOperation>) {
    super()
  }

  toDOM() {
    const widget = document.createElement('span')
    widget.classList.add('ol-cm-change')
    widget.classList.add('ol-cm-change-d')

    return widget
  }

  eq() {
    return true
  }
}

class ChangeCalloutWidget extends WidgetType {
  constructor(
    public change: Change,
    public opType: string
  ) {
    super()
  }

  toDOM() {
    const widget = document.createElement('span')
    widget.className = 'ol-cm-change-callout'
    widget.classList.add(`ol-cm-change-callout-${this.opType}`)

    const inner = document.createElement('span')
    inner.classList.add('ol-cm-change-callout-inner')
    widget.appendChild(inner)

    return widget
  }

  eq(widget: ChangeCalloutWidget) {
    return widget.opType === this.opType
  }

  updateDOM(element: HTMLElement) {
    element.className = 'ol-cm-change-callout'
    element.classList.add(`ol-cm-change-callout-${this.opType}`)
    return true
  }
}

const createChangeRange = (
  change: Change,
  currentDoc: DocumentContainer,
  data?: RangesData
) => {
  const { id, metadata, op } = change

  const from = op.p
  // TODO: find valid positions?

  if (isDeleteOperation(op)) {
    const opType = 'd'

    const changeWidget = Decoration.widget({
      widget: new ChangeDeletedWidget(change as Change<DeleteOperation>),
      side: 1,
      opType,
      id,
      metadata,
    })

    const calloutWidget = Decoration.widget({
      widget: new ChangeCalloutWidget(change, opType),
      side: 1,
      opType,
      id,
      metadata,
    })

    return [calloutWidget.range(from, from), changeWidget.range(from, from)]
  }

  const _isCommentOperation = isCommentOperation(op)

  if (
    _isCommentOperation &&
    (currentDoc.ranges as RangesTrackerWithResolvedThreadIds)
      .resolvedThreadIds![op.t]
  ) {
    return []
  }

  if (_isCommentOperation) {
    if (data) {
      const thread = data.threads[op.t]
      if (!thread || thread.resolved) {
        return []
      }
    } else if (
      (currentDoc.ranges as RangesTrackerWithResolvedThreadIds)
        .resolvedThreadIds![op.t]
    ) {
      return []
    }
  }

  const opType = _isCommentOperation ? 'c' : 'i'
  const changedText = _isCommentOperation ? op.c : op.i
  const to = from + changedText.length

  // Mark decorations must not be empty
  if (from === to) {
    return []
  }

  const changeMark = Decoration.mark({
    tagName: 'span',
    class: `ol-cm-change ol-cm-change-${opType}`,
    opType,
    id,
    metadata,
  })

  const calloutWidget = Decoration.widget({
    widget: new ChangeCalloutWidget(change, opType),
    opType,
    id,
    metadata,
  })

  return [calloutWidget.range(from, from), changeMark.range(from, to)]
}

/**
 * Remove tracked changes from the range tracker when they're rejected,
 * and restore the original content
 */
export const rejectChanges = (
  state: EditorState,
  ranges: DocumentContainer['ranges'],
  changeIds: string[]
) => {
  const changes = ranges!.getChanges(changeIds) as Change<EditOperation>[]

  if (changes.length === 0) {
    return {}
  }

  // When doing bulk rejections, adjacent changes might interact with each other.
  // Consider an insertion with an adjacent deletion (which is a common use-case, replacing words):
  //
  //     "foo bar baz" -> "foo quux baz"
  //
  // The change above will be modeled with two ops, with the insertion going first:
  //
  //     foo quux baz
  //         |--| -> insertion of "quux", op 1, at position 4
  //             | -> deletion of "bar", op 2, pushed forward by "quux" to position 8
  //
  // When rejecting these changes at once, if the insertion is rejected first, we get unexpected
  // results. What happens is:
  //
  //     1) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
  //        starting from position 4;
  //
  //           "foo quux baz" -> "foo  baz"
  //                |--| -> 4 characters to be removed
  //
  //     2) Rejecting the deletion adds the deleted word "bar" at position 8 (i.e. it will act as if
  //        the word "quuux" was still present).
  //
  //            "foo  baz" -> "foo  bazbar"
  //                     | -> deletion of "bar" is reverted by reinserting "bar" at position 8
  //
  // While the intended result would be "foo bar baz", what we get is:
  //
  //      "foo  bazbar" (note "bar" readded at position 8)
  //
  // The issue happens because of step 1. To revert the insertion of "quux", 4 characters are deleted
  // from position 4. This includes the position where the deletion exists; when that position is
  // cleared, the RangesTracker considers that the deletion is gone and stops tracking/updating it.
  // As we still hold a reference to it, the code tries to revert it by readding the deleted text, but
  // does so at the outdated position (position 8, which was valid when "quux" was present).
  //
  // To avoid this kind of problem, we need to make sure that reverting operations doesn't affect
  // subsequent operations that come after. Reverse sorting the operations based on position will
  // achieve it; in the case above, it makes sure that the the deletion is reverted first:
  //
  //     1) Rejecting the deletion adds the deleted word "bar" at position 8
  //
  //            "foo quux baz" -> "foo quuxbar baz"
  //                                       | -> deletion of "bar" is reverted by
  //                                            reinserting "bar" at position 8
  //
  //     2) Rejecting the insertion deletes the added word "quux", i.e., it removes 4 chars
  //        starting from position 4 and achieves the expected result:
  //
  //           "foo quuxbar baz" -> "foo bar baz"
  //                |--| -> 4 characters to be removed

  changes.sort((a, b) => b.op.p - a.op.p)

  const changesToDispatch = changes.map(change => {
    const { op } = change

    if (isInsertOperation(op)) {
      const from = op.p
      const content = op.i
      const to = from + content.length

      const text = state.doc.sliceString(from, to)

      if (text !== content) {
        throw new Error(`Op to be removed does not match editor text`)
      }

      return { from, to, insert: '' }
    } else if (isDeleteOperation(op)) {
      return {
        from: op.p,
        to: op.p,
        insert: op.d,
      }
    } else {
      throw new Error(`unknown change type: ${JSON.stringify(change)}`)
    }
  })

  return {
    changes: changesToDispatch,
    annotations: [trackChangesAnnotation.of('reject')],
  }
}

const trackChangesTheme = EditorView.baseTheme({
  '.cm-line': {
    overflowX: 'hidden', // needed so the callout elements don't overflow (requires line wrapping to be on)
  },
  '&light .ol-cm-change-i': {
    backgroundColor: '#2c8e304d',
  },
  '&dark .ol-cm-change-i': {
    backgroundColor: 'rgba(37, 107, 41, 0.15)',
  },
  '&light .ol-cm-change-c': {
    backgroundColor: '#f3b1114d',
  },
  '&dark .ol-cm-change-c': {
    backgroundColor: 'rgba(194, 93, 11, 0.15)',
  },
  '.ol-cm-change': {
    padding: 'var(--half-leading, 0) 0',
  },
  '.ol-cm-change-d': {
    borderLeft: '2px dotted #c5060b',
    marginLeft: '-1px',
  },
  '.ol-cm-change-callout': {
    position: 'relative',
    pointerEvents: 'none',
    padding: 'var(--half-leading, 0) 0',
  },
  '.ol-cm-change-callout-inner': {
    display: 'inline-block',
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '100vw',
    borderBottom: '1px dashed black',
  },
  // disable callout line in Firefox
  '@supports (-moz-appearance:none)': {
    '.ol-cm-change-callout-inner': {
      display: 'none',
    },
  },
  '.ol-cm-change-callout-i .ol-cm-change-callout-inner': {
    borderColor: '#2c8e30',
  },
  '.ol-cm-change-callout-c .ol-cm-change-callout-inner': {
    borderColor: '#f3b111',
  },
  '.ol-cm-change-callout-d .ol-cm-change-callout-inner': {
    borderColor: '#c5060b',
  },
})
