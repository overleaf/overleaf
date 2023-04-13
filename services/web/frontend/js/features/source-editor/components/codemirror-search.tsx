import { createPortal } from 'react-dom'
import CodeMirrorSearchForm from './codemirror-search-form'
import { useCodeMirrorViewContext } from './codemirror-editor'

function CodeMirrorSearch() {
  const view = useCodeMirrorViewContext()

  const dom = view.dom.querySelector('.ol-cm-search')

  if (!dom) {
    return null
  }

  return createPortal(<CodeMirrorSearchForm />, dom)
}

export default CodeMirrorSearch
