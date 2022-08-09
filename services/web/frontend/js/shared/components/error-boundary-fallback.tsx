import { FC, ReactNode } from 'react'
import { Alert } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'

export const ErrorBoundaryFallback: FC<{ modal?: ReactNode }> = ({
  children,
  modal,
}) => {
  return (
    <div className="error-boundary-alert">
      <Alert bsStyle="danger">{children || <DefaultContent />}</Alert>
      {modal}
    </div>
  )
}

const DefaultContent = () => {
  const { t } = useTranslation()

  return <p>{`${t('generic_something_went_wrong')}. ${t('please_refresh')}`}</p>
}
