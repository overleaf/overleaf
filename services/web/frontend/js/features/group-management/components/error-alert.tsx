import { useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'

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
      <OLNotification
        type="error"
        content={`${t('error')}: ${error.message}`}
      />
    )
  }

  return (
    <OLNotification type="error" content={t('generic_something_went_wrong')} />
  )
}
