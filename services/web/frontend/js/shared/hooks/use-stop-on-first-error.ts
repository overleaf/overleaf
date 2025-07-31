import { useCallback } from 'react'
import { useDetachCompileContext as useCompileContext } from '../context/detach-compile-context'
import { useProjectContext } from '../context/project-context'
import * as eventTracking from '../../infrastructure/event-tracking'

type UseStopOnFirstErrorProps = {
  eventSource?: string
}

export function useStopOnFirstError(opts: UseStopOnFirstErrorProps = {}) {
  const { eventSource } = opts
  const { stopOnFirstError, setStopOnFirstError } = useCompileContext()
  const { projectId } = useProjectContext()

  type Opts = {
    projectId: string
    source?: UseStopOnFirstErrorProps['eventSource']
  }

  const enableStopOnFirstError = useCallback(() => {
    if (!stopOnFirstError) {
      const opts: Opts = { projectId }
      if (eventSource) {
        opts.source = eventSource
      }
      eventTracking.sendMB('stop-on-first-error-enabled', opts)
    }
    setStopOnFirstError(true)
  }, [eventSource, projectId, stopOnFirstError, setStopOnFirstError])

  const disableStopOnFirstError = useCallback(() => {
    const opts: Opts = { projectId }
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
