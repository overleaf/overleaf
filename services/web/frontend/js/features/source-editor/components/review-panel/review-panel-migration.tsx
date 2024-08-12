import React, { FC, lazy, Suspense } from 'react'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import LoadingSpinner from '@/shared/components/loading-spinner'

const ReviewPanel = lazy(() => import('./review-panel'))

const ReviewPanelNew = lazy(
  () => import('../../../review-panel-new/components/review-panel-container')
)

export const ReviewPanelMigration: FC = () => {
  const newReviewPanel = useFeatureFlag('review-panel-redesign')

  return (
    <Suspense fallback={<LoadingSpinner delay={500} />}>
      {newReviewPanel ? <ReviewPanelNew /> : <ReviewPanel />}
    </Suspense>
  )
}
