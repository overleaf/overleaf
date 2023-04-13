import { EditorSelection, Extension } from '@codemirror/state'
import {
  BlockInfo,
  EditorView,
  lineNumbers as cmLineNumbers,
} from '@codemirror/view'
import { DebouncedFunc, throttle } from 'lodash'

export function lineNumbers(): Extension {
  let listener: DebouncedFunc<(event: MouseEvent) => boolean> | null

  function disableListener() {
    if (listener) {
      document.removeEventListener('mousemove', listener)
      listener = null
    }
  }

  // Creates a selection range capped within the document bounds. The range is
  // anchored at the beginning so that it is a full line that is selected
  function selection(view: EditorView, start: BlockInfo, end: BlockInfo) {
    const clamp = (num: number) =>
      Math.max(0, Math.min(view.state.doc.length, num))

    let startPos = start.from
    let endPos = end.to + 1
    if (start.from === end.from) {
      // Selecting one line
      startPos = end.to + 1
      endPos = start.from
    } else if (end.from < start.from) {
      // End is prior to start
      endPos = end.from
      startPos = start.to + 1
    }
    return EditorSelection.range(clamp(startPos), clamp(endPos))
  }

  // Wrapper around the built-in codemirror lineNumbers() extension
  return cmLineNumbers({
    domEventHandlers: {
      mousedown: (view, line, event) => {
        // Disable default focusing of line number
        event.preventDefault()

        // If we already have a listener, disable it
        disableListener()
        view.dispatch({
          selection: selection(view, line, line),
        })

        // Focus the editor
        view.contentDOM.focus()

        // Set up new listener to track the mouse position
        listener = throttle((event: MouseEvent) => {
          // Check if we've missed a mouseup event by validating that the
          // primary mouse button is still being held
          if (event.buttons !== 1) {
            disableListener()
            return false
          }

          // Map the mouse cursor to the document, and select the lines matched
          const documentPosition = view.posAtCoords({
            x: event.pageX,
            y: event.pageY,
          })
          if (documentPosition) {
            const endLine = view.lineBlockAt(documentPosition)
            view.dispatch({
              selection: selection(view, line, endLine),
            })
          }
        }, 50)
        document.addEventListener('mousemove', listener)
        return false
      },
      mouseup: () => {
        disableListener()
        return false
      },
    },
  })
}
