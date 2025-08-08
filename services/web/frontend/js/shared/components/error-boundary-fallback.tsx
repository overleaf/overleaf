import { FC, ReactNode } from 'react'
import { DefaultMessage } from './default-message'
import OLNotification from '@/shared/components/ol/ol-notification'

export const ErrorBoundaryFallback: FC<
  React.PropsWithChildren<{ modal?: ReactNode }>
> = ({ children, modal }) => {
  return (
    <div className="error-boundary-alert">
      <OLNotification type="error" content={children || <DefaultMessage />} />
      {modal}
    </div>
  )
}
