import Icon from '../../../../../shared/components/icon'
import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'
import { getUserFacingMessage } from '../../../../../infrastructure/fetch-json'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLNotification from '@/features/ui/components/ol/ol-notification'

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
          bs3Props={{
            icon: <Icon type="exclamation-triangle" fw />,
            className: 'text-center',
          }}
        />
      )}
    </div>
  )
}

export default Layout
