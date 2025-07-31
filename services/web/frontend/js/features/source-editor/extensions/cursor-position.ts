import {
  EditorSelection,
  EditorState,
  Text,
  TransactionSpec,
} from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { findValidPosition } from '../utils/position'
import customLocalStorage from '../../../infrastructure/local-storage'
import { debugConsole } from '@/utils/debugging'

const buildStorageKey = (docId: string) => `doc.position.${docId}`

/**
 * A custom extension that:
 * a) stores the cursor position in localStorage when the view is destroyed or the window is closed.
 * b) dispatches the cursor position when it changes, for use with “show position in PDF”.
 */
export const cursorPosition = ({
  currentDoc: { doc_id: docId },
}: {
  currentDoc: { doc_id: string }
}) => {
  return [
    // store cursor position
    ViewPlugin.define(view => {
      const unloadListener = () => {
        storeCursorPosition(view, docId)
      }

      window.addEventListener('unload', unloadListener)

      return {
        destroy: () => {
          window.removeEventListener('unload', unloadListener)
          unloadListener()
        },
      }
    }),

    // Asynchronously dispatch cursor position when the selection changes and
    // provide a little debouncing. Using requestAnimationFrame postpones it
    // until the next CM6 DOM update.
    ViewPlugin.define(() => {
      let animationFrameRequest: number | null = null

      return {
        update(update) {
          if (update.selectionSet || update.docChanged) {
            if (animationFrameRequest) {
              window.cancelAnimationFrame(animationFrameRequest)
            }
            animationFrameRequest = window.requestAnimationFrame(() => {
              animationFrameRequest = null
              dispatchCursorPosition(update.state)
            })
          }
        },
      }
    }),
  ]
}

// convert the selection head to a row and column
const buildCursorPosition = (state: EditorState) => {
  const pos = state.selection.main.head
  const line = state.doc.lineAt(pos)
  const row = line.number - 1 // 0-indexed
  const column = pos - line.from
  return { row, column }
}

// dispatch the current cursor position for use with synctex
const dispatchCursorPosition = (state: EditorState) => {
  const cursorPosition = buildCursorPosition(state)

  window.dispatchEvent(
    new CustomEvent('cursor:editor:update', { detail: cursorPosition })
  )
}

// store the cursor position for restoring on load
const storeCursorPosition = (view: EditorView, docId: string) => {
  const key = buildStorageKey(docId)
  const data = customLocalStorage.getItem(key)

  const cursorPosition = buildCursorPosition(view.state)

  customLocalStorage.setItem(key, { ...data, cursorPosition })
}

// restore the stored cursor position on load
export const restoreCursorPosition = (
  doc: Text,
  docId: string
): TransactionSpec => {
  try {
    const key = buildStorageKey(docId)
    const data = customLocalStorage.getItem(key)

    const { row = 0, column = 0 } = data?.cursorPosition || {}

    // restore the cursor to its original position, or the end of the document if past the end
    const { lines } = doc
    const lineNumber = row < lines ? row + 1 : lines
    const line = doc.line(lineNumber)
    const offset = line.from + column
    const pos = Math.min(offset || 0, doc.length)

    return {
      selection: EditorSelection.cursor(pos),
    }
  } catch (error) {
    // ignore invalid cursor position
    debugConsole.debug('invalid cursor position', error)
    return {}
  }
}

const createClampedSelection = (max: number, from: number, to?: number) => {
  if (to === undefined) {
    return EditorSelection.cursor(Math.min(from, max))
  }

  return EditorSelection.range(Math.min(from, max), Math.min(to, max))
}

const dispatchSelectionAndScroll = (
  view: EditorView,
  from: number,
  to?: number
) => {
  window.setTimeout(() => {
    const selection = createClampedSelection(view.state.doc.length, from, to)
    view.dispatch({
      selection,
      effects: EditorView.scrollIntoView(selection, { y: 'center' }),
    })
    view.focus()
  })
}

export const setCursorLineAndScroll = (
  view: EditorView,
  lineNumber: number,
  columnNumber?: number,
  selectText?: string
) => {
  // TODO: map the position through any changes since the previous compile?

  const { doc } = view.state

  const from = findValidPosition(doc, lineNumber, columnNumber)

  if (selectText) {
    if (columnNumber === undefined) {
      // somewhere on this line
      const line = doc.lineAt(from)
      const index = line.text.indexOf(selectText)
      if (index > -1 && index === line.text.lastIndexOf(selectText)) {
        const from = line.from + index
        const to = from + selectText.length
        dispatchSelectionAndScroll(view, from, to)
        return
      }
    } else {
      // at this exact position
      const to = from + selectText.length
      if (doc.sliceString(from, to) === selectText) {
        dispatchSelectionAndScroll(view, from, to)
        return
      }
    }
  }

  dispatchSelectionAndScroll(view, from)
}

export const setCursorPositionAndScroll = (view: EditorView, pos: number) => {
  dispatchSelectionAndScroll(view, pos)
}
