import OLNotification from '@/shared/components/ol/ol-notification'
import { useTranslation } from 'react-i18next'

export const WordCountError = () => {
  const { t } = useTranslation()

  return (
    <OLNotification type="error" content={t('generic_something_went_wrong')} />
  )
}
