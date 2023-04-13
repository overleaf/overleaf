import { syntaxTree } from '@codemirror/language'
import { EditorSelection, StateEffect, StateField } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  hoverTooltip,
  keymap,
  ViewPlugin,
  WidgetType,
} from '@codemirror/view'
import { CodeMirror, Vim, getCM } from '@replit/codemirror-vim'

export default {
  Decoration,
  EditorSelection,
  EditorView,
  StateEffect,
  StateField,
  ViewPlugin,
  WidgetType,
  hoverTooltip,
  keymap,
  syntaxTree,
}

export const CodeMirrorVim = {
  CodeMirror,
  Vim,
  getCM,
}
