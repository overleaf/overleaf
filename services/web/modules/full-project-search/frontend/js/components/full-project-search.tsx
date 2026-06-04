import React, { FC, lazy, Suspense } from 'react'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { ErrorBoundaryFallback } from '@/shared/components/error-boundary-fallback'

const FullProjectSearchUI = lazy(() => import('./full-project-search-ui'))

const FullProjectSearch: FC = () => {
  return (
    <Suspense fallback={null}>
      <FullProjectSearchUI />
    </Suspense>
  )
}

export default withErrorBoundary(FullProjectSearch, () => (
  <ErrorBoundaryFallback />
))
