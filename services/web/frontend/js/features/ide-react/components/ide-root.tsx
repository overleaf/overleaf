import { GenericErrorBoundaryFallback } from '@/shared/components/generic-error-boundary-fallback'
import withErrorBoundary from '@/infrastructure/error-boundary'
import IdePage from '@/features/ide-react/components/layout/ide-page'
import { ReactContextRoot } from '@/features/ide-react/context/react-context-root'
import { Loading } from '@/features/ide-react/components/loading'
import getMeta from '@/utils/meta'

function IdeRoot() {
  // Check that we haven't inadvertently loaded Angular
  // TODO: Remove this before rolling out this component to any users
  if (typeof window.angular !== 'undefined') {
    throw new Error('Angular detected. This page must not load Angular.')
  }

  const loadingText = getMeta('ol-loadingText')

  return (
    <ReactContextRoot>
      <Loading loadingText={loadingText}>
        <IdePage />
      </Loading>
    </ReactContextRoot>
  )
}

export default withErrorBoundary(IdeRoot, GenericErrorBoundaryFallback)
