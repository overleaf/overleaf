import React, { FC, lazy, Suspense } from 'react'
import LoadingSpinner from '@/shared/components/loading-spinner'

const ReviewPanelContainer = lazy(() => import('./review-panel-container'))

export const ReviewPanelRoot: FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner delay={500} />}>
      <ReviewPanelContainer />
    </Suspense>
  )
}
