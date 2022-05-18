import { Row, Alert } from 'react-bootstrap'
import Icon from '../../../../../shared/components/icon'
import { UseAsyncReturnType } from '../../../../../shared/hooks/use-async'
import { getUserFacingMessage } from '../../../../../infrastructure/fetch-json'

type LayoutProps = {
  children: React.ReactNode
  isError: UseAsyncReturnType['isError']
  error: UseAsyncReturnType['error']
}

function Layout({ isError, error, children }: LayoutProps) {
  return (
    <div className="affiliations-table-row--highlighted">
      <Row>{children}</Row>
      {isError && (
        <Alert bsStyle="danger" className="text-center">
          <Icon type="exclamation-triangle" fw /> {getUserFacingMessage(error)}
        </Alert>
      )}
    </div>
  )
}

export default Layout
