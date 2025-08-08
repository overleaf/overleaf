import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'
import { getUserFacingMessage } from '../../../../../infrastructure/fetch-json'
import OLRow from '@/shared/components/ol/ol-row'
import OLNotification from '@/shared/components/ol/ol-notification'

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
        <OLNotification
          type="error"
          content={getUserFacingMessage(error) ?? ''}
        />
      )}
    </div>
  )
}

export default Layout
