import { BlockInfo, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { throttle } from 'lodash'
import customLocalStorage from '../../../infrastructure/local-storage'
import {
  EditorSelection,
  StateEffect,
  Text,
  TransactionSpec,
} from '@codemirror/state'
import { sourceOnly, toggleVisualEffect } from './visual/visual'
import { debugConsole } from '@/utils/debugging'

const buildStorageKey = (docId: string) => `doc.position.${docId}`

type LineInfo = {
  first: BlockInfo
  middle: BlockInfo
}

/**
 * A custom extension that:
 * a) stores the scroll position (first visible line number) in localStorage when the view is destroyed,
 *    or the window is closed, or when switching between Source and Rich Text, and
 * b) dispatches the scroll position (middle visible line) when it changes, for use in the outline.
 */
export const scrollPosition = (
  {
    currentDoc: { doc_id: docId },
  }: {
    currentDoc: { doc_id: string }
  },
  { visual }: { visual: boolean }
) => {
  // store lineInfo for use on unload, when the DOM has already been unmounted
  let lineInfo: LineInfo

  const scrollHandler = throttle(
    (event, view) => {
      // exclude a scroll event with no target, which happens when switching docs
      if (event.target === view.scrollDOM) {
        lineInfo = calculateLineInfo(view)
        dispatchScrollPosition(lineInfo, view)
      }
    },
    // long enough to capture intent, but short enough that the selected heading in the outline appears current
    120,
    { trailing: true }
  )

  return [
    // store/dispatch scroll position
    ViewPlugin.define(
      view => {
        const unloadListener = () => {
          if (lineInfo) {
            storeScrollPosition(lineInfo, view, docId)
          }
        }

        window.addEventListener('unload', unloadListener)

        return {
          update: (update: ViewUpdate) => {
            for (const tr of update.transactions) {
              for (const effect of tr.effects) {
                if (effect.is(toggleVisualEffect)) {
                  // store the scroll position when switching between source and rich text
                  if (lineInfo) {
                    storeScrollPosition(lineInfo, view, docId)
                  }
                } else if (effect.is(restoreScrollPositionEffect)) {
                  // restore the scroll position
                  window.setTimeout(() => {
                    view.dispatch(scrollStoredLineToTop(tr.state.doc, docId))
                    window.dispatchEvent(
                      new Event('editor:scroll-position-restored')
                    )
                  })
                }
              }
            }
          },
          destroy: () => {
            scrollHandler.cancel()
            window.removeEventListener('unload', unloadListener)
            unloadListener()
          },
        }
      },
      {
        eventHandlers: {
          scroll: scrollHandler,
        },
      }
    ),

    // restore the scroll position when switching to source mode
    sourceOnly(
      visual,
      EditorView.updateListener.of(update => {
        for (const tr of update.transactions) {
          for (const effect of tr.effects) {
            if (effect.is(toggleVisualEffect)) {
              if (!effect.value) {
                // switching to the source editor
                window.setTimeout(() => {
                  update.view.dispatch(restoreScrollPosition())
                  update.view.focus()
                })
              }
            }
          }
        }
      })
    ),
  ]
}

const restoreScrollPositionEffect = StateEffect.define()

export const restoreScrollPosition = () => {
  return {
    effects: restoreScrollPositionEffect.of(null),
  }
}

const calculateLineInfo = (view: EditorView) => {
  // the top of the scrollDOM element relative to the top of the document
  const { top, height } = view.scrollDOM.getBoundingClientRect()
  const distanceFromDocumentTop = top - view.documentTop

  return {
    first: view.lineBlockAtHeight(distanceFromDocumentTop),
    // top plus half the height of the scrollDOM element
    middle: view.lineBlockAtHeight(distanceFromDocumentTop + height / 2),
  }
}

// dispatch the middle visible line number (for the outline)
const dispatchScrollPosition = (lineInfo: LineInfo, view: EditorView) => {
  const middleVisibleLine = view.state.doc.lineAt(lineInfo.middle.from).number

  window.dispatchEvent(
    new CustomEvent('scroll:editor:update', {
      detail: middleVisibleLine,
    })
  )
}

// store the scroll position (first visible line number, for restoring on load)
const storeScrollPosition = (
  lineInfo: LineInfo,
  view: EditorView,
  docId: string
) => {
  const key = buildStorageKey(docId)
  const data = customLocalStorage.getItem(key)
  const pos = Math.min(lineInfo.first.from, view.state.doc.length)
  const firstVisibleLine = view.state.doc.lineAt(pos).number

  customLocalStorage.setItem(key, { ...data, firstVisibleLine })
}

// restore the scroll position using the stored first visible line number
const scrollStoredLineToTop = (doc: Text, docId: string): TransactionSpec => {
  try {
    const key = buildStorageKey(docId)
    const data = customLocalStorage.getItem(key)

    // restore the scroll position to its original position, or the last line of the document
    const firstVisibleLine = Math.min(data?.firstVisibleLine ?? 1, doc.lines)

    const line = doc.line(firstVisibleLine)

    const selectionRange = EditorSelection.cursor(line.from)

    return {
      effects: EditorView.scrollIntoView(selectionRange, {
        y: 'start',
        yMargin: 0,
      }),
    }
  } catch (e) {
    // ignore invalid line number
    debugConsole.error(e)
    return {}
  }
}
