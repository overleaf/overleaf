import { useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'

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
      <OLNotification
        type="error"
        content={error.data.message}
        className="row-spaced-small"
      />
    )
  }

  return (
    <OLNotification
      type="error"
      content={t('generic_something_went_wrong')}
      className="row-spaced-small"
    />
  )
}

export default ModalError
