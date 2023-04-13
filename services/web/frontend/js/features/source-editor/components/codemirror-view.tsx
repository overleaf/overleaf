import { memo, useCallback, useEffect } from 'react'
import { useCodeMirrorViewContext } from './codemirror-editor'
import useCodeMirrorScope from '../hooks/use-codemirror-scope'

function CodeMirrorView() {
  const view = useCodeMirrorViewContext()

  // append the editor view dom to the container node when mounted
  const containerRef = useCallback(
    node => {
      if (node) {
        node.appendChild(view.dom)
      }
    },
    [view]
  )

  // destroy the editor when unmounted
  useEffect(() => {
    return () => {
      view.destroy()
    }
  }, [view])

  useCodeMirrorScope(view)

  return <div ref={containerRef} style={{ height: '100%' }} />
}

export default memo(CodeMirrorView)
