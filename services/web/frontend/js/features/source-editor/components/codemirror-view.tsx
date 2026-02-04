import { memo, useCallback, useEffect } from 'react'
import { useCodeMirrorViewContext } from './codemirror-context'
import useCodeMirrorScope from '../hooks/use-codemirror-scope'
import { useEditorViewContext } from '@/features/ide-react/context/editor-view-context'

type CodeMirrorViewProps = {
  hidden: boolean
}

function CodeMirrorView({ hidden = false }: CodeMirrorViewProps) {
  const view = useCodeMirrorViewContext()

  const { setView } = useEditorViewContext()

  // append the editor view dom to the container node when mounted
  const containerRef = useCallback(
    (node: HTMLDivElement) => {
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

  // Add the CodeMirror view to the editor view context so that it can be
  // accessed outside the editor component
  useEffect(() => {
    setView(view)
  }, [setView, view])

  useCodeMirrorScope(view)

  return <div ref={containerRef} style={{ height: '100%' }} hidden={hidden} />
}

export default memo(CodeMirrorView)
