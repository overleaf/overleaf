import { useCallback } from 'react'
import getMeta from '../../../utils/meta'
import { useDetachCompileContext as useCompileContext } from '../../../shared/context/detach-compile-context'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useDetachAction from '../../../shared/hooks/use-detach-action'

const showPdfDetach = getMeta('ol-showPdfDetach')

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
}
