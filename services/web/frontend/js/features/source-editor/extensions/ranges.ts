import { StateEffect, StateField, TransactionSpec } from '@codemirror/state'
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
import { Ranges } from '@/features/review-panel-new/context/ranges-context'
import { Threads } from '@/features/review-panel-new/context/threads-context'
import { isSelectionWithinOp } from '@/features/review-panel-new/utils/is-selection-within-op'

type RangesData = {
  ranges: Ranges
  threads: Threads
}

const updateRangesEffect = StateEffect.define<RangesData>()
const highlightRangesEffect = StateEffect.define<AnyOperation>()
const clearHighlightRangesEffect = StateEffect.define<AnyOperation>()

export const updateRanges = (data: RangesData): TransactionSpec => {
  return {
    effects: updateRangesEffect.of(data),
  }
}
export const highlightRanges = (op: AnyOperation): TransactionSpec => {
  return {
    effects: highlightRangesEffect.of(op),
  }
}
export const clearHighlightRanges = (op: AnyOperation): TransactionSpec => {
  return {
    effects: clearHighlightRangesEffect.of(op),
  }
}

export const rangesDataField = StateField.define<RangesData | null>({
  create() {
    return null
  },
  update(rangesData, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateRangesEffect)) {
        return effect.value
      }
    }
    return rangesData
  },
})

/**
 * A custom extension that initialises the change manager, passes any updates to it,
 * and produces decorations for tracked changes and comments.
 */
export const ranges = () => [
  rangesDataField,
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
        decorations: Decoration.none,
        update(update) {
          for (const transaction of update.transactions) {
            this.decorations = this.decorations.map(transaction.changes)

            for (const effect of transaction.effects) {
              if (effect.is(updateRangesEffect)) {
                this.decorations = buildChangeDecorations(effect.value)
              } else if (
                effect.is(highlightRangesEffect) &&
                isDeleteOperation(effect.value)
              ) {
                this.decorations = updateDeleteWidgetHighlight(
                  this.decorations,
                  widget =>
                    widget.change.op.p === effect.value.p &&
                    widget.highlightType !== 'focus',
                  'highlight'
                )
              } else if (
                effect.is(clearHighlightRangesEffect) &&
                isDeleteOperation(effect.value)
              ) {
                this.decorations = updateDeleteWidgetHighlight(
                  this.decorations,
                  widget =>
                    widget.change.op.p === effect.value.p &&
                    widget.highlightType !== 'focus',
                  null
                )
              }
            }

            if (transaction.selection) {
              this.decorations = updateDeleteWidgetHighlight(
                this.decorations,
                ({ change }) =>
                  isSelectionWithinOp(change.op, update.state.selection.main),
                'focus'
              )
              this.decorations = updateDeleteWidgetHighlight(
                this.decorations,
                ({ change }) =>
                  !isSelectionWithinOp(change.op, update.state.selection.main),
                null
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
              } else if (effect.is(clearHighlightRangesEffect)) {
                this.decorations = Decoration.none
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
    view => {
      return {
        decorations: Decoration.none,
        update(update) {
          if (
            !update.transactions.some(
              tr =>
                tr.selection ||
                tr.effects.some(effect => effect.is(updateRangesEffect))
            )
          ) {
            return
          }

          this.decorations = Decoration.none
          const rangesData = view.state.field(rangesDataField)

          if (!rangesData?.ranges) {
            return
          }
          const { changes, comments } = rangesData.ranges
          const unresolvedComments = rangesData.threads
            ? comments.filter(
                comment =>
                  comment.op.t &&
                  rangesData.threads[comment.op.t] &&
                  !rangesData.threads[comment.op.t].resolved
              )
            : []

          for (const range of [...changes, ...unresolvedComments]) {
            if (isSelectionWithinOp(range.op, update.state.selection.main)) {
              this.decorations = buildHighlightDecorations(
                'ol-cm-change-focus',
                range.op
              )
              break
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

const updateDeleteWidgetHighlight = (
  decorations: DecorationSet,
  predicate: (widget: ChangeDeletedWidget) => boolean,
  highlightType?: 'focus' | 'highlight' | null
) => {
  const widgetsToReplace: ChangeDeletedWidget[] = []
  const cursor = decorations.iter()
  while (cursor.value) {
    const widget = cursor.value.spec?.widget
    if (widget instanceof ChangeDeletedWidget && predicate(widget)) {
      widgetsToReplace.push(cursor.value.spec.widget)
    }
    cursor.next()
  }

  return decorations.update({
    sort: true,
    filter: (from, to, decoration) => {
      return !widgetsToReplace.includes(decoration.spec?.widget)
    },
    add: widgetsToReplace.map(({ change }) =>
      Decoration.widget({
        widget: new ChangeDeletedWidget(change, highlightType),
        side: 1,
        opType: 'd',
        id: change.id,
        metadata: change.metadata,
      }).range(change.op.p, change.op.p)
    ),
  })
}

const buildHighlightDecorations = (className: string, op: AnyOperation) => {
  if (isDeleteOperation(op)) {
    // delete indicators are handled in change decorations
    return Decoration.none
  }

  const opFrom = op.p
  const opLength = isInsertOperation(op) ? op.i.length : op.c.length
  const opType = isInsertOperation(op) ? 'i' : 'c'

  if (opLength === 0) {
    return Decoration.none
  }

  return Decoration.set(
    Decoration.mark({
      class: `${className} ${className}-${opType}`,
    }).range(opFrom, opFrom + opLength),
    true
  )
}

class ChangeDeletedWidget extends WidgetType {
  constructor(
    public change: Change<DeleteOperation>,
    public highlightType: 'highlight' | 'focus' | null = null
  ) {
    super()
  }

  toDOM() {
    const widget = document.createElement('span')
    widget.classList.add('ol-cm-change')
    widget.classList.add('ol-cm-change-d')
    if (this.highlightType) {
      widget.classList.add(`ol-cm-change-d-${this.highlightType}`)
    }
    return widget
  }

  eq(old: ChangeDeletedWidget) {
    return old.highlightType === this.highlightType
  }
}

const createChangeRange = (change: Change, data: RangesData) => {
  const { id, metadata, op } = change

  const from = op.p

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
  '.ol-cm-change-i, .ol-cm-change-highlight-i, .ol-cm-change-focus-i': {
    backgroundColor: 'rgba(44, 142, 48, 0.30)',
  },
  '&light .ol-cm-change-c, &light .ol-cm-change-highlight-c, &light .ol-cm-change-focus-c':
    {
      backgroundColor: 'rgba(243, 177, 17, 0.30)',
    },
  '&dark .ol-cm-change-c, &dark .ol-cm-change-highlight-c, &dark .ol-cm-change-focus-c':
    {
      backgroundColor: 'rgba(194, 93, 11, 0.15)',
    },
  '.ol-cm-change': {
    padding: 'var(--half-leading, 0) 0',
  },
  '.ol-cm-change-highlight': {
    padding: 'var(--half-leading, 0) 0',
  },
  '.ol-cm-change-focus': {
    padding: 'var(--half-leading, 0) 0',
  },
  '&light .ol-cm-change-d': {
    borderLeft: '2px dotted #c5060b',
    marginLeft: '-1px',
  },
  '&dark .ol-cm-change-d': {
    borderLeft: '2px dotted #c5060b',
    marginLeft: '-1px',
  },
  '&light .ol-cm-change-d-highlight': {
    borderLeft: '3px solid #c5060b',
    marginLeft: '-2px',
  },
  '&dark .ol-cm-change-d-highlight': {
    borderLeft: '3px solid #c5060b',
    marginLeft: '-2px',
  },
  '&light .ol-cm-change-d-focus': {
    borderLeft: '3px solid #B83A33',
    marginLeft: '-2px',
  },
  '&dark .ol-cm-change-d-focus': {
    borderLeft: '3px solid #B83A33',
    marginLeft: '-2px',
  },
})
