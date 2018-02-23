import CodeMirror, { Doc } from 'codemirror'

export function init(rootEl) {
  return CodeMirror(rootEl)
}

export function openDoc(cm, content) {
  const newDoc = Doc(content)
  cm.swapDoc(newDoc)
  return newDoc
}
