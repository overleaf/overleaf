import { type KeyBinding, keymap } from '@codemirror/view'
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

export const shortcuts = () => {
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

  const keyBindings: KeyBinding[] = [
    {
      key: 'Tab',
      run: indentMore,
    },
    {
      key: 'Shift-Tab',
      run: indentLess,
    },
    {
      key: 'Ctrl-y',
      mac: 'Mod-y',
      preventDefault: true,
      run: redo,
    },
    {
      key: 'Ctrl-Shift-z',
      preventDefault: true,
      run: redo,
    },
    {
      key: 'Ctrl-Shift-/',
      mac: 'Mod-Shift-/',
      preventDefault: true,
      run: toggleLineComment,
    },
    {
      key: 'Ctrl-ß',
      mac: 'Mod-ß',
      preventDefault: true,
      run: toggleLineComment,
    },
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
      key: 'Ctrl-d',
      mac: 'Mod-d',
      preventDefault: true,
      run: deleteLine,
    },
    {
      key: 'Ctrl-j',
      mac: 'Mod-j',
      preventDefault: true,
      run: toggleReviewPanel,
    },
    {
      key: 'Ctrl-Shift-c',
      mac: 'Mod-Shift-c',
      preventDefault: true,
      run: addNewCommentFromKbdShortcut,
    },
    {
      key: 'Ctrl-Shift-a',
      mac: 'Mod-Shift-a',
      preventDefault: true,
      run: toggleTrackChangesFromKbdShortcut,
    },
    {
      key: 'Ctrl-Alt-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, true),
    },
    {
      key: 'Ctrl-Alt-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, true),
    },
    {
      key: 'Ctrl-Alt-Shift-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, false),
    },
    {
      key: 'Ctrl-Alt-Shift-ArrowDown',
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
      key: 'Ctrl-Shift-d',
      mac: 'Mod-Shift-d',
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
      mac: 'Mod-Backspace',
      run: deleteToVisualLineStart,
    },
    {
      mac: 'Mod-Delete',
      run: deleteToVisualLineEnd,
    },
  ]

  return Prec.high(keymap.of(keyBindings))
}
