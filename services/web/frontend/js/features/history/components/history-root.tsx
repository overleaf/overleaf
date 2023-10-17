import { HistoryProvider } from '../context/history-context'
import { useLayoutContext } from '../../../shared/context/layout-context'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import { ErrorBoundaryFallback } from '../../../shared/components/error-boundary-fallback'
import withErrorBoundary from '../../../infrastructure/error-boundary'
import { lazy, Suspense } from 'react'

const HistoryContent = lazy(() => import('./history-content'))

function Main() {
  const { view } = useLayoutContext()

  if (view !== 'history') {
    return null
  }

  return (
    <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
      <HistoryContent />
    </Suspense>
  )
}

function HistoryRoot() {
  return (
    <HistoryProvider>
      <Main />
    </HistoryProvider>
  )
}

export default withErrorBoundary(HistoryRoot, ErrorBoundaryFallback)
