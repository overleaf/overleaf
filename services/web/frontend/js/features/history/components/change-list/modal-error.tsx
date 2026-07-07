import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'

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
    return (
      <div className="notification-list">
        <Notification
          type="error"
          content={error.data.message}
          className="row-spaced-small"
        />
      </div>
    )
  }

  return (
    <div className="notification-list">
      <Notification
        type="error"
        content={t('generic_something_went_wrong')}
        className="row-spaced-small"
      />
    </div>
  )
}

export default ModalError
