import Notification from '@/shared/components/notification'
import { useTranslation } from 'react-i18next'

export const WordCountError = () => {
  const { t } = useTranslation()

  return (
    <div className="notification-list">
      <Notification type="error" content={t('generic_something_went_wrong')} />
    </div>
  )
}
