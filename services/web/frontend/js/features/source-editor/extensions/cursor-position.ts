import {
  EditorSelection,
  EditorState,
  SelectionRange,
  Text,
  TransactionSpec,
} from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'
import { findValidPosition } from '../utils/position'
import customLocalStorage from '../../../infrastructure/local-storage'

const buildStorageKey = (docId: string) => `doc.position.${docId}`

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
    ViewPlugin.define(view => {
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
    console.debug('invalid cursor position', error)
    return {}
  }
}

const dispatchSelectionAndScroll = (
  view: EditorView,
  selection: SelectionRange
) => {
  view.dispatch({
    selection,
    effects: EditorView.scrollIntoView(selection, { y: 'center' }),
  })

  view.focus()
}

export const setCursorLineAndScroll = (
  view: EditorView,
  lineNumber: number,
  columnNumber = 0
) => {
  // TODO: map the position through any changes since the previous compile?

  let selectionRange
  try {
    const pos = findValidPosition(view.state.doc, lineNumber, columnNumber)
    selectionRange = EditorSelection.cursor(pos)
  } catch (error) {
    // ignore invalid cursor position
    console.debug('invalid cursor position', error)
  }

  if (selectionRange) {
    dispatchSelectionAndScroll(view, selectionRange)
  }
}

export const setCursorPositionAndScroll = (view: EditorView, pos: number) => {
  let selectionRange
  try {
    pos = Math.min(pos, view.state.doc.length)
    selectionRange = EditorSelection.cursor(pos)
  } catch (error) {
    // ignore invalid cursor position
    console.debug('invalid cursor position', error)
  }

  if (selectionRange) {
    dispatchSelectionAndScroll(view, selectionRange)
  }
}
