import { useCallback, useEffect } from 'react'
import useEventListener from '../../../shared/hooks/use-event-listener'
import useDetachAction from '../../../shared/hooks/use-detach-action'

export const startCompileKeypress = (
  event: KeyboardEvent | React.KeyboardEvent<Element>
) => {
  if (event.shiftKey || event.altKey) {
    return false
  }

  if (event.ctrlKey) {
    // Ctrl+s / Ctrl+Enter / Ctrl+.
    if (event.key === 's' || event.key === 'Enter' || event.key === '.') {
      return true
    }

    // Ctrl+s with Caps-Lock on
    if (event.key === 'S' && !event.shiftKey) {
      return true
    }
  } else if (event.metaKey) {
    // Cmd+s / Cmd+Enter
    if (event.key === 's' || event.key === 'Enter') {
      return true
    }

    // Cmd+s with Caps-Lock on
    if (event.key === 'S' && !event.shiftKey) {
      return true
    }
  }
}

export default function useCompileTriggers(
  startCompile: (...args: any[]) => Promise<void>,
  setChangedAt: (...args: any[]) => void
) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
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
}
