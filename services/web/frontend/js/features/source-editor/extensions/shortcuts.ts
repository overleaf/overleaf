import { keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { indentMore } from '../commands/indent'
import {
  indentLess,
  redo,
  deleteLine,
  toggleLineComment,
  cursorLineBoundaryBackward,
  selectLineBoundaryBackward,
  cursorLineBoundaryForward,
  selectLineBoundaryForward,
  cursorSyntaxLeft,
  selectSyntaxLeft,
  cursorSyntaxRight,
  selectSyntaxRight,
} from '@codemirror/commands'
import { changeCase, duplicateSelection } from '../commands/ranges'
import { selectOccurrence } from '../commands/select'
import { cloneSelectionVertically } from '../commands/cursor'
import { dispatchEditorEvent } from './changes/change-manager'
import {
  deleteToVisualLineEnd,
  deleteToVisualLineStart,
} from './visual-line-selection'

const toggleReviewPanel = () => {
  dispatchEditorEvent('toggle-review-panel')
  return true
}

const addNewCommentFromKbdShortcut = () => {
  dispatchEditorEvent('add-new-comment')
  return true
}

const toggleTrackChangesFromKbdShortcut = () => {
  dispatchEditorEvent('toggle-track-changes')
  return true
}

export const shortcuts = Prec.high(
  keymap.of([
    {
      key: 'Tab',
      run: indentMore,
    },
    {
      key: 'Shift-Tab',
      run: indentLess,
    },
    {
      key: 'Mod-y',
      preventDefault: true,
      run: redo,
    },
    {
      key: 'Mod-Shift-z',
      preventDefault: true,
      run: redo,
    },

    // defaultKeymap maps Mod-/ to toggleLineComment, but
    // w3c-keyname has a hard-coded mapping of Shift+key => character
    // which uses a US keyboard layout, so we need to add more mappings.

    // Mod-/, but Spanish, Portuguese, German and Swedish keyboard layouts have / at Shift+7
    // (keyCode 55, mapped with Shift to &)
    {
      key: 'Mod-&',
      preventDefault: true,
      run: toggleLineComment,
    },
    // Mod-/, but German keyboard layouts have / at Cmd+Shift+ß
    // Mod-/, but Czech keyboard layouts have / at Shift-ú
    // (keyCode 191, mapped with Shift to ?)
    {
      key: 'Mod-?',
      preventDefault: true,
      run: toggleLineComment,
    },
    // German keyboard layouts map 0xBF to #,
    // so VS Code on Windows/Linux uses Ctrl-# to toggle line comments.
    // This is an additional, undocumented shortcut for compatibility.
    {
      key: 'Ctrl-#',
      preventDefault: true,
      run: toggleLineComment,
    },

    {
      key: 'Ctrl-u',
      preventDefault: true,
      run: changeCase(true), // uppercase
    },
    {
      key: 'Ctrl-Shift-u',
      preventDefault: true,
      run: changeCase(false), // lowercase
    },
    {
      key: 'Mod-d',
      preventDefault: true,
      run: deleteLine,
    },
    {
      key: 'Mod-j',
      preventDefault: true,
      run: toggleReviewPanel,
    },
    {
      key: 'Mod-Shift-c',
      preventDefault: true,
      run: addNewCommentFromKbdShortcut,
    },
    {
      key: 'Mod-Shift-a',
      preventDefault: true,
      run: toggleTrackChangesFromKbdShortcut,
    },
    {
      key: 'Mod-Alt-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, true),
    },
    {
      key: 'Mod-Alt-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, true),
    },
    {
      key: 'Mod-Alt-Shift-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, false),
    },
    {
      key: 'Mod-Alt-Shift-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, false),
    },
    // duplicates of the above commands, allowing Ctrl on macOS for backwards compatibility
    {
      mac: 'Ctrl-Alt-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, true),
    },
    {
      mac: 'Ctrl-Alt-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, true),
    },
    {
      mac: 'Ctrl-Alt-Shift-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, false),
    },
    {
      mac: 'Ctrl-Alt-Shift-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, false),
    },
    {
      key: 'Ctrl-Alt-ArrowLeft',
      preventDefault: true,
      run: selectOccurrence(false),
    },
    {
      key: 'Ctrl-Alt-ArrowRight',
      preventDefault: true,
      run: selectOccurrence(true),
    },
    {
      key: 'Mod-Shift-d',
      run: duplicateSelection,
    },
    {
      win: 'Alt-ArrowLeft',
      linux: 'Alt-ArrowLeft',
      run: cursorLineBoundaryBackward,
      shift: selectLineBoundaryBackward,
      preventDefault: true,
    },
    {
      win: 'Alt-ArrowRight',
      linux: 'Alt-ArrowRight',
      run: cursorLineBoundaryForward,
      shift: selectLineBoundaryForward,
      preventDefault: true,
    },
    {
      mac: 'Ctrl-ArrowLeft',
      run: cursorSyntaxLeft,
      shift: selectSyntaxLeft,
    },
    {
      mac: 'Ctrl-ArrowRight',
      run: cursorSyntaxRight,
      shift: selectSyntaxRight,
    },
    {
      mac: 'Cmd-Backspace',
      run: deleteToVisualLineStart,
    },
    {
      mac: 'Cmd-Delete',
      run: deleteToVisualLineEnd,
    },
  ])
)
