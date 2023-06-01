import { FC, ReactNode } from 'react'
import { Alert } from 'react-bootstrap'
import { DefaultMessage } from './default-message'

export const ErrorBoundaryFallback: FC<{ modal?: ReactNode }> = ({
  children,
  modal,
}) => {
  return (
    <div className="error-boundary-alert">
      <Alert bsStyle="danger">{children || <DefaultMessage />}</Alert>
      {modal}
    </div>
  )
}
