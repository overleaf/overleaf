import { useCallback } from 'react'
import { useDetachCompileContext as useCompileContext } from '../context/detach-compile-context'
import { useProjectContext } from '../context/project-context'
import * as eventTracking from '../../infrastructure/event-tracking'

export function useStopOnFirstError(opts = {}) {
  const { eventSource } = opts
  const { stopOnFirstError, setStopOnFirstError } = useCompileContext()
  const { _id: projectId } = useProjectContext()

  const enableStopOnFirstError = useCallback(() => {
    if (!stopOnFirstError) {
      const opts = { projectId }
      if (eventSource) {
        opts.source = eventSource
      }
      eventTracking.sendMB('stop-on-first-error-enabled', opts)
    }
    setStopOnFirstError(true)
  }, [eventSource, projectId, stopOnFirstError, setStopOnFirstError])

  const disableStopOnFirstError = useCallback(() => {
    const opts = { projectId }
    if (eventSource) {
      opts.source = eventSource
    }
    if (stopOnFirstError) {
      eventTracking.sendMB('stop-on-first-error-disabled', opts)
    }
    setStopOnFirstError(false)
  }, [eventSource, projectId, stopOnFirstError, setStopOnFirstError])

  return { enableStopOnFirstError, disableStopOnFirstError }
}
