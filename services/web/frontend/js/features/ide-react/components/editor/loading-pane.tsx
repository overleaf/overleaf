import { FC } from 'react'
import LoadingSpinner from '@/shared/components/loading-spinner'

export const LoadingPane: FC = () => {
  return (
    <div className="loading-panel">
      <LoadingSpinner />
    </div>
  )
}
