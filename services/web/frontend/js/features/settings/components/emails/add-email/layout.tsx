import { Alert } from 'react-bootstrap'
import Icon from '../../../../../shared/components/icon'
import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'
import { getUserFacingMessage } from '../../../../../infrastructure/fetch-json'
import RowWrapper from '@/features/ui/components/bootstrap-5/wrappers/row-wrapper'

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
        <Alert bsStyle="danger" className="text-center">
          <Icon type="exclamation-triangle" fw /> {getUserFacingMessage(error)}
        </Alert>
      )}
    </div>
  )
}

export default Layout
