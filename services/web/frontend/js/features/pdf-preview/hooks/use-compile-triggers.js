import { useCallback } from 'react'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useDetachAction from '../../../shared/hooks/use-detach-action'

export default function useCompileTriggers() {
  const { startCompile, setChangedAt } = useCompileContext()

  // recompile on key press
  const startOrTriggerCompile = useDetachAction(
    'start-compile',
    startCompile,
    'detacher',
    'detached'
  )
  const compileHandler = useCallback(
    event => {
      startOrTriggerCompile(event.detail)
    },
    [startOrTriggerCompile]
  )
  useEventListener('pdf:recompile', compileHandler)

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
