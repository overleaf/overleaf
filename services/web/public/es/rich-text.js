import CodeMirror, { Doc } from 'codemirror'

export function init (rootEl) {
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
