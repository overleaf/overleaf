import useEventListener from '@/shared/hooks/use-event-listener'
import { useLocalCompileContext } from '@/shared/context/local-compile-context'
import { useCallback } from 'react'

export function useHasLintingError() {
  const { setHasLintingError } = useLocalCompileContext()

  // Listen for editor:lint event from CM6 linter and keep compile context
  // up to date
  useEventListener(
    'editor:lint',
    useCallback(
      (event: CustomEvent) => {
        setHasLintingError(event.detail.hasLintingError)
      },
      [setHasLintingError]
    )
  )
}
