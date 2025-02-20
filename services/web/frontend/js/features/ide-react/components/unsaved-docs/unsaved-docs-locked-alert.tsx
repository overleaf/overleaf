import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import OLNotification from '@/features/ui/components/ol/ol-notification'

export const UnsavedDocsLockedAlert: FC = () => {
  const { t } = useTranslation()

  return (
    <OLNotification
      type="warning"
      content={
        <>
          <strong>{t('connection_lost_with_unsaved_changes')}</strong>{' '}
          {t('dont_reload_or_close_this_tab')} {t('your_changes_will_save')}
        </>
      }
    />
  )
}
