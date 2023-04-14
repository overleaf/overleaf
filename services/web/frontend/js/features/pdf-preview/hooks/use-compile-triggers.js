import { useCallback, useEffect } from 'react'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useDetachAction from '../../../shared/hooks/use-detach-action'

export const startCompileKeypress = event => {
  if (event.shiftKey || event.altKey) {
    return false
  }

  if (event.ctrlKey) {
    // Ctrl+s / Ctrl+Enter / Ctrl+.
    if (event.key === 's' || event.key === 'Enter' || event.key === '.') {
      return true
    }
  } else if (event.metaKey) {
    // Cmd+s / Cmd+Enter
    if (event.key === 's' || event.key === 'Enter') {
      return true
    }
  }
}

export default function useCompileTriggers(
  startCompile,
  setChangedAt,
  setSavedAt
) {
  const handleKeyDown = useCallback(
    event => {
      if (startCompileKeypress(event)) {
        event.preventDefault()
        startCompile()
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

  // record when the server acknowledges saving changes
  const setOrTriggerSavedAt = useDetachAction(
    'set-saved-at',
    setSavedAt,
    'detacher',
    'detached'
  )
  const setSavedAtHandler = useCallback(() => {
    setOrTriggerSavedAt(Date.now())
  }, [setOrTriggerSavedAt])
  useEventListener('doc:saved', setSavedAtHandler)
}
