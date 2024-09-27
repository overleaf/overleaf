import { memo, useCallback, useEffect } from 'react'
import { useCodeMirrorViewContext } from './codemirror-context'
import useCodeMirrorScope from '../hooks/use-codemirror-scope'
import useScopeValueSetterOnly from '@/shared/hooks/use-scope-value-setter-only'

function CodeMirrorView() {
  const view = useCodeMirrorViewContext()

  const [, setView] = useScopeValueSetterOnly('editor.view')

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

  // add the editor view to the scope value store, so it can be accessed by external extensions
  useEffect(() => {
    setView(view)
  }, [setView, view])

  useCodeMirrorScope(view)

  return <div ref={containerRef} style={{ height: '100%' }} />
}

export default memo(CodeMirrorView)
