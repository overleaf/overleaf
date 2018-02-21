import CodeMirror, { Doc } from 'codemirror'

import LatexParser from './ide/editor/codemirror/parser'

export function init (rootEl) {
  CodeMirror.defineMode('latex', () => new LatexParser())
  CodeMirror.defineMIME('application/x-tex', 'latex')
  CodeMirror.defineMIME('application/x-latex', 'latex')

  return CodeMirror(rootEl, {
    mode: 'latex'
  })
}

export function openDoc (cm, content) {
  const newDoc = Doc(content, 'latex')
  cm.swapDoc(newDoc)
  return newDoc
}
