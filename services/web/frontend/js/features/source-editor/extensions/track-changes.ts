import { StateEffect } from '@codemirror/state'
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type PluginValue,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { Change, DeleteOperation } from '../../../../../types/change'
import { ChangeManager } from './changes/change-manager'
import { debugConsole } from '@/utils/debugging'
import { isCommentOperation, isDeleteOperation } from '@/utils/operations'
import {
  DocumentContainer,
  RangesTrackerWithResolvedThreadIds,
} from '@/features/ide-react/editor/document-container'

const clearChangesEffect = StateEffect.define()
const buildChangesEffect = StateEffect.define()

type Options = {
  currentDoc: DocumentContainer
  loadingThreads: boolean
}

/**
 * A custom extension that initialises the change manager, passes any updates to it,
 * and produces decorations for tracked changes and comments.
 */
export const trackChanges = (
  { currentDoc, loadingThreads }: Options,
  changeManager: ChangeManager
) => {
  return [
    // initialize/destroy the change manager, and handle any updates
    ViewPlugin.define(() => {
      changeManager.initialize()

      return {
        update: update => {
          changeManager.handleUpdate(update)
        },
        destroy: () => {
          changeManager.destroy()
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
          decorations: loadingThreads
            ? Decoration.none
            : buildChangeDecorations(currentDoc),
          update(update) {
            for (const transaction of update.transactions) {
              this.decorations = this.decorations.map(transaction.changes)

              for (const effect of transaction.effects) {
                if (effect.is(clearChangesEffect)) {
                  this.decorations = Decoration.none
                } else if (effect.is(buildChangesEffect)) {
                  this.decorations = buildChangeDecorations(currentDoc)
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

const buildChangeDecorations = (currentDoc: DocumentContainer) => {
  if (!currentDoc.ranges) {
    return Decoration.none
  }

  const changes = [...currentDoc.ranges.changes, ...currentDoc.ranges.comments]

  const decorations = []

  for (const change of changes) {
    try {
      decorations.push(...createChangeRange(change, currentDoc))
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

const createChangeRange = (change: Change, currentDoc: DocumentContainer) => {
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
