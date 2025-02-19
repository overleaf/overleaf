import { useLayoutContext } from '../../../shared/context/layout-context'
import { FullSizeLoadingSpinner } from '../../../shared/components/loading-spinner'
import { lazy, Suspense } from 'react'

const HistoryRoot = lazy(
  () => import('@/features/ide-react/components/history-root')
)

function HistoryContainer() {
  const { view } = useLayoutContext()

  if (view !== 'history') {
    return null
  }

  return (
    <Suspense fallback={<FullSizeLoadingSpinner delay={500} />}>
      <HistoryRoot />
    </Suspense>
  )
}

export default HistoryContainer
