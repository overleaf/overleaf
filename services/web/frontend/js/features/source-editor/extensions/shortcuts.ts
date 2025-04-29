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
import { selectNextOccurrence, selectPrevOccurrence } from '../commands/select'
import { cloneSelectionVertically } from '../commands/cursor'
import {
  deleteToVisualLineEnd,
  deleteToVisualLineStart,
} from './visual-line-selection'
import { emitShortcutEvent } from '@/features/source-editor/extensions/toolbar/utils/analytics'

const toggleReviewPanel = () => {
  window.dispatchEvent(new Event('ui.toggle-review-panel'))
  return true
}

const addNewCommentFromKbdShortcut = () => {
  window.dispatchEvent(new Event('add-new-review-comment'))
  return true
}

const toggleTrackChangesFromKbdShortcut = () => {
  window.dispatchEvent(new Event('toggle-track-changes'))
  return true
}

/**
 * Custom key bindings for motion, transformation, selection, history, etc.
 */
export const shortcuts = Prec.high(
  keymap.of([
    {
      key: 'Tab',
      run: indentMore, // note: not using indentWithTab as the user may want to insert tab spaces within a line
    },
    {
      key: 'Shift-Tab',
      run: indentLess, // note: not using indentWithTab as the user may want to insert tab spaces within a line
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
      run(view) {
        emitShortcutEvent(view, 'delete-line')
        return deleteLine(view)
      },
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
      key: 'Cmd-Alt-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, true, 'cmd'),
    },
    {
      key: 'Cmd-Alt-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, true, 'cmd'),
    },
    {
      key: 'Cmd-Alt-Shift-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, false, 'cmd'),
    },
    {
      key: 'Cmd-Alt-Shift-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, false, 'cmd'),
    },
    // Duplicates of the above commands,
    // allowing Ctrl instead of Command (but still tracking the events separately).
    // Note: both Ctrl and Commmand versions need to work on macOS, for backwards compatibility,
    // so the duplicates shouldn't simply be combined to use `Mod-`.
    {
      key: 'Ctrl-Alt-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, true, 'ctrl'),
    },
    {
      key: 'Ctrl-Alt-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, true, 'ctrl'),
    },
    {
      key: 'Ctrl-Alt-Shift-ArrowUp',
      preventDefault: true,
      run: cloneSelectionVertically(false, false, 'ctrl'),
    },
    {
      key: 'Ctrl-Alt-Shift-ArrowDown',
      preventDefault: true,
      run: cloneSelectionVertically(true, false, 'ctrl'),
    },
    {
      key: 'Ctrl-Alt-ArrowLeft',
      preventDefault: true,
      run(view) {
        emitShortcutEvent(view, 'select-prev-occurrence')
        return selectPrevOccurrence(view)
      },
    },
    {
      key: 'Ctrl-Alt-ArrowRight',
      preventDefault: true,
      run(view) {
        emitShortcutEvent(view, 'select-next-occurrence')
        return selectNextOccurrence(view)
      },
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
