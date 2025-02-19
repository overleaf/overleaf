import { memo } from 'react'
import { HistoryProvider } from '@/features/history/context/history-context'
import withErrorBoundary from '@/infrastructure/error-boundary'
import { ErrorBoundaryFallback } from '@/shared/components/error-boundary-fallback'
import History from './history'

const HistoryRoot = () => (
  <HistoryProvider>
    <History />
  </HistoryProvider>
)

export default withErrorBoundary(memo(HistoryRoot), ErrorBoundaryFallback)
