import Icon from '../../../../../shared/components/icon'
import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'
import { getUserFacingMessage } from '../../../../../infrastructure/fetch-json'
import RowWrapper from '@/features/ui/components/bootstrap-5/wrappers/row-wrapper'
import NotificationWrapper from '@/features/ui/components/bootstrap-5/wrappers/notification-wrapper'

type LayoutProps = {
  children: React.ReactNode
  isError: UseAsyncReturnType['isError']
  error: UseAsyncReturnType['error']
}

function Layout({ isError, error, children }: LayoutProps) {
  return (
    <div className="affiliations-table-row--highlighted">
      <RowWrapper>{children}</RowWrapper>
      {isError && (
        <NotificationWrapper
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
