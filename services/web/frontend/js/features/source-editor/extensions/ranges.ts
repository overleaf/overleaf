import { StateEffect, TransactionSpec } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type PluginValue,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import {
  AnyOperation,
  Change,
  DeleteOperation,
} from '../../../../../types/change'
import { debugConsole } from '@/utils/debugging'
import {
  isCommentOperation,
  isDeleteOperation,
  isInsertOperation,
} from '@/utils/operations'
import { DocumentContainer } from '@/features/ide-react/editor/document-container'
import { Ranges } from '@/features/review-panel-new/context/ranges-context'
import { Threads } from '@/features/review-panel-new/context/threads-context'
import { isSelectionWithinOp } from '@/features/review-panel-new/utils/is-selection-within-op'

type RangesData = {
  ranges: Ranges
  threads: Threads
}

const updateRangesEffect = StateEffect.define<RangesData>()
const highlightRangesEffect = StateEffect.define<AnyOperation | undefined>()

export const updateRanges = (data: RangesData): TransactionSpec => {
  return {
    effects: updateRangesEffect.of(data),
  }
}

export const highlightRanges = (op?: AnyOperation): TransactionSpec => {
  return {
    effects: highlightRangesEffect.of(op),
  }
}

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
export const ranges = ({ ranges, threads }: Options) => {
  return [
    // handle viewportChanged updates
    ViewPlugin.define(view => {
      let timer: number

      return {
        update(update) {
          if (update.viewportChanged) {
            if (timer) {
              window.clearTimeout(timer)
            }

            timer = window.setTimeout(() => {
              dispatchEvent(new Event('editor:viewport-changed'))
            }, 25)
          }
        },
      }
    }),

    // draw change decorations
    ViewPlugin.define<
      PluginValue & {
        decorations: DecorationSet
      }
    >(
      () => {
        return {
          decorations:
            ranges && threads
              ? buildChangeDecorations({ ranges, threads })
              : Decoration.none,
          update(update) {
            for (const transaction of update.transactions) {
              this.decorations = this.decorations.map(transaction.changes)

              for (const effect of transaction.effects) {
                if (effect.is(updateRangesEffect)) {
                  this.decorations = buildChangeDecorations(effect.value)
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

    // draw highlight decorations
    ViewPlugin.define<
      PluginValue & {
        decorations: DecorationSet
      }
    >(
      () => {
        return {
          decorations: Decoration.none,
          update(update) {
            for (const transaction of update.transactions) {
              this.decorations = this.decorations.map(transaction.changes)

              for (const effect of transaction.effects) {
                if (effect.is(highlightRangesEffect)) {
                  this.decorations = buildHighlightDecorations(
                    'ol-cm-change-highlight',
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

    // draw focus decorations
    ViewPlugin.define<
      PluginValue & {
        decorations: DecorationSet
      }
    >(
      () => {
        return {
          decorations: Decoration.none,
          update(update) {
            this.decorations = Decoration.none

            if (!ranges) {
              return
            }

            for (const range of [...ranges.changes, ...ranges.comments]) {
              if (isSelectionWithinOp(range.op, update.state.selection.main)) {
                this.decorations = buildHighlightDecorations(
                  'ol-cm-change-focus',
                  range.op
                )
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

const buildChangeDecorations = (data: RangesData) => {
  if (!data.ranges) {
    return Decoration.none
  }

  const changes = [...data.ranges.changes, ...data.ranges.comments]

  const decorations = []

  for (const change of changes) {
    try {
      decorations.push(...createChangeRange(change, data))
    } catch (error) {
      // ignore invalid changes
      debugConsole.debug('invalid change position', error)
    }
  }

  return Decoration.set(decorations, true)
}

const buildHighlightDecorations = (className: string, op?: AnyOperation) => {
  if (!op) {
    return Decoration.none
  }

  if (isDeleteOperation(op)) {
    // nothing to highlight for deletions (for now)
    // TODO: add highlight when delete indicator is done
    return Decoration.none
  }

  const opFrom = op.p
  const opLength = isInsertOperation(op) ? op.i.length : op.c.length
  const opType = isInsertOperation(op) ? 'i' : 'c'

  return Decoration.set(
    Decoration.mark({
      class: `${className} ${className}-${opType}`,
    }).range(opFrom, opFrom + opLength),
    true
  )
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

const createChangeRange = (change: Change, data: RangesData) => {
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

    return [changeWidget.range(from, from)]
  }

  const _isCommentOperation = isCommentOperation(op)

  if (_isCommentOperation) {
    const thread = data.threads[op.t]
    if (!thread || thread.resolved) {
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

  return [changeMark.range(from, to)]
}

const trackChangesTheme = EditorView.baseTheme({
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
  '&light .ol-cm-change-highlight-i': {
    backgroundColor: '#b8dbc899',
  },
  '&dark .ol-cm-change-highlight-i': {
    backgroundColor: '#b8dbc899',
  },
  '&light .ol-cm-change-highlight-c': {
    backgroundColor: '#fcc4837d',
  },
  '&dark .ol-cm-change-highlight-c': {
    backgroundColor: '#fcc4837d',
  },
  '&light .ol-cm-change-focus-i': {
    backgroundColor: '#B8DBC8',
  },
  '&dark .ol-cm-change-focus-i': {
    backgroundColor: '#B8DBC8',
  },
  '&light .ol-cm-change-focus-c': {
    backgroundColor: '#FCC483',
  },
  '&dark .ol-cm-change-focus-c': {
    backgroundColor: '#FCC483',
  },
})
