import { Command, EditorView, keymap } from '@codemirror/view'

function scrollByLine(view: EditorView, lineCount: number) {
  view.scrollDOM.scrollTop += view.defaultLineHeight * lineCount
}

const scrollUpOneLine: Command = (view: EditorView) => {
  scrollByLine(view, -1)
  // Always consume the keypress to prevent the cursor going up a line when the
  // editor is scrolled to the top
  return true
}

const scrollDownOneLine: Command = (view: EditorView) => {
  scrollByLine(view, 1)
  // Always consume the keypress to prevent the cursor going down a line when
  // the editor is scrolled to the bottom
  return true
}

export function scrollOneLine() {
  // Applied to Windows and Linux only
  return keymap.of([
    {
      linux: 'Ctrl-ArrowUp',
      win: 'Ctrl-ArrowUp',
      run: scrollUpOneLine,
    },
    {
      linux: 'Ctrl-ArrowDown',
      win: 'Ctrl-ArrowDown',
      run: scrollDownOneLine,
    },
  ])
}
