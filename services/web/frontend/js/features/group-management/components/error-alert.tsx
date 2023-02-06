import { useTranslation } from 'react-i18next'

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
      <div className="alert alert-danger">
        {t('error')}: {error.message}
      </div>
    )
  }

  return (
    <div className="alert alert-danger">
      {t('generic_something_went_wrong')}
    </div>
  )
}
