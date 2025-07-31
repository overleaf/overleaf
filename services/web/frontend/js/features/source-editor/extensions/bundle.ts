import { syntaxTree } from '@codemirror/language'
import {
  ChangeSet,
  EditorSelection,
  Prec,
  StateEffect,
  StateField,
} from '@codemirror/state'
import {
  Decoration,
  EditorView,
  hoverTooltip,
  keymap,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import {
  undo,
  redo,
  invertedEffects,
  isolateHistory,
} from '@codemirror/commands'
import { CodeMirror, Vim, getCM } from '@replit/codemirror-vim'

export default {
  ChangeSet,
  Decoration,
  EditorSelection,
  EditorView,
  Prec,
  StateEffect,
  StateField,
  ViewPlugin,
  WidgetType,
  hoverTooltip,
  keymap,
  syntaxTree,
  undo,
  redo,
  invertedEffects,
  isolateHistory,
}

export const CodeMirrorVim = {
  CodeMirror,
  Vim,
  getCM,
}
