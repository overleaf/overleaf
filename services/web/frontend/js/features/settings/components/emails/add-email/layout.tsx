import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'
import { getUserFacingMessage } from '../../../../../infrastructure/fetch-json'
import OLRow from '@/shared/components/ol/ol-row'
import Notification from '@/shared/components/notification'

type LayoutProps = {
  children: React.ReactNode
  isError: UseAsyncReturnType['isError']
  error: UseAsyncReturnType['error']
}

function Layout({ isError, error, children }: LayoutProps) {
  return (
    <div className="affiliations-table-row-highlighted">
      <OLRow>{children}</OLRow>
      {isError && (
        <div className="notification-list">
          <Notification
            type="error"
            content={getUserFacingMessage(error) ?? ''}
          />
        </div>
      )}
    </div>
  )
}

export default Layout
