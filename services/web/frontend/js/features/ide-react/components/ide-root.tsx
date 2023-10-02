import useWaitForI18n from '@/shared/hooks/use-wait-for-i18n'
import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import withErrorBoundary from '@/infrastructure/error-boundary'
import IdePage from '@/features/ide-react/components/layout/ide-page'

function IdeRoot() {
  // Check that we haven't inadvertently loaded Angular
  // TODO: Remove this before rolling out this component to any users
  if (typeof window.angular !== 'undefined') {
    throw new Error('Angular detected. This page must not load Angular.')
  }

  const { isReady } = useWaitForI18n()

  if (!isReady) {
    return null
  }

  return <IdePage />
}

export default withErrorBoundary(IdeRoot, GenericErrorBoundaryFallback)
