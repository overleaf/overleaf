import { FC, ReactNode } from 'react'
import { DefaultMessage } from './default-message'
import OLNotification from '@/features/ui/components/ol/ol-notification'

export const ErrorBoundaryFallback: FC<{ modal?: ReactNode }> = ({
  children,
  modal,
}) => {
  return (
    <div className="error-boundary-alert">
      <OLNotification type="error" content={children || <DefaultMessage />} />
      {modal}
    </div>
  )
}
