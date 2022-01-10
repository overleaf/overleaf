import { useCallback, useEffect } from 'react'
import getMeta from '../../../utils/meta'
import { useCompileContext } from '../../../shared/context/compile-context'
import { useDetachContext } from '../../../shared/context/detach-context'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useDetachAction from '../../../shared/hooks/use-detach-action'
import usePreviousValue from '../../../shared/hooks/use-previous-value'

const showPdfDetach = getMeta('ol-showPdfDetach')
const debugPdfDetach = getMeta('ol-debugPdfDetach')

export default function useCompileTriggers() {
  const { startCompile, setChangedAt, cleanupCompileResult, setError } =
    useCompileContext()
  const { role: detachRole } = useDetachContext()

  // recompile on key press
  const startOrTriggerCompile = useDetachAction(
    'start-compile',
    startCompile,
    'detacher',
    'detached'
  )
  const compileHandler = useCallback(
    event => {
      showPdfDetach
        ? startOrTriggerCompile(event.detail)
        : startCompile(event.detail)
    },
    [startOrTriggerCompile, startCompile]
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
    showPdfDetach ? setOrTriggerChangedAt(Date.now()) : setChangedAt(Date.now())
  }, [setOrTriggerChangedAt, setChangedAt])
  useEventListener('doc:changed', setChangedAtHandler)
  useEventListener('doc:saved', setChangedAtHandler)

  // clear preview and recompile when the detach role is reset
  const previousDetachRole = usePreviousValue(detachRole)
  useEffect(() => {
    if (previousDetachRole && !detachRole) {
      if (debugPdfDetach) {
        console.log('Recompile on reattach', { previousDetachRole, detachRole })
      }
      cleanupCompileResult()
      setError()
      startCompile()
    }
  }, [
    cleanupCompileResult,
    setError,
    startCompile,
    previousDetachRole,
    detachRole,
  ])
}
