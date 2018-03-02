import CodeMirror, { Doc } from 'codemirror'

import LatexMode from './ide/editor/codemirror/LatexMode'

export function init (rootEl) {
  CodeMirror.defineMode('latex', () => new LatexMode())
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
