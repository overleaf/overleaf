import { memo } from 'react'
import { HistoryProvider } from '@/features/history/context/history-context'
import History from './history'

const HistoryRoot = () => (
  <HistoryProvider>
    <History />
  </HistoryProvider>
)

export default memo(HistoryRoot)
