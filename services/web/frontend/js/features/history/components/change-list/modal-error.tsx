import { useTranslation } from 'react-i18next'
import { Alert } from 'react-bootstrap'

// Using this workaround due to inconsistent and improper error responses from the server
type ModalErrorProps = {
  error: {
    response?: Response
    data?: {
      message?: string
    }
  }
}

function ModalError({ error }: ModalErrorProps) {
  const { t } = useTranslation()

  if (error.response?.status === 400 && error.data?.message) {
    return <Alert bsStyle="danger">{error.data.message}</Alert>
  }

  return <Alert bsStyle="danger">{t('generic_something_went_wrong')}</Alert>
}

export default ModalError
