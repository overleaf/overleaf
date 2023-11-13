import useEventListener from '@/shared/hooks/use-event-listener'
import { useLocalCompileContext } from '@/shared/context/local-compile-context'

export function useHasLintingError() {
  const { setHasLintingError } = useLocalCompileContext()

  // Listen for editor:lint event from CM6 linter and keep compile context
  // up to date
  useEventListener('editor:lint', (event: CustomEvent) => {
    setHasLintingError(event.detail.hasLintingError)
  })
}
