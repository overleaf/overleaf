import { useCallback, useEffect } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useDetachAction from '../../../shared/hooks/use-detach-action'

export default function useCompileTriggers() {
  const { startCompile, setChangedAt } = useCompileContext()

  const handleKeyDown = useCallback(
    event => {
      if (event.metaKey) {
        switch (event.key) {
          case 's':
          case 'Enter':
            event.preventDefault()
            startCompile()
            break
        }
      } else if (event.ctrlKey) {
        switch (event.key) {
          case '.':
            event.preventDefault()
            startCompile()
            break
        }
      }
    },
    [startCompile]
  )

  const handleStartCompile = useCallback(() => {
    startCompile()
  }, [startCompile])
  useEventListener('pdf:recompile', handleStartCompile)

  useEffect(() => {
    document.body.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // record doc changes when notified by the editor
  const setOrTriggerChangedAt = useDetachAction(
    'set-changed-at',
    setChangedAt,
    'detacher',
    'detached'
  )
  const setChangedAtHandler = useCallback(() => {
    setOrTriggerChangedAt(Date.now())
  }, [setOrTriggerChangedAt])
  useEventListener('doc:changed', setChangedAtHandler)
  useEventListener('doc:saved', setChangedAtHandler) // TODO: store this separately?
}
