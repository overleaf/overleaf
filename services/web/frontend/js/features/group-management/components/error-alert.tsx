import { useTranslation } from 'react-i18next'
import Notification from '@/shared/components/notification'

export type APIError = {
  message?: string
}

type ErrorAlertProps = {
  error?: APIError
}

export default function ErrorAlert({ error }: ErrorAlertProps) {
  const { t } = useTranslation()

  if (!error) {
    return null
  }

  if (error.message) {
    return (
      <div className="notification-list">
        <Notification
          type="error"
          content={`${t('error')}: ${error.message}`}
        />
      </div>
    )
  }

  return (
    <div className="notification-list">
      <Notification type="error" content={t('generic_something_went_wrong')} />
    </div>
  )
}
