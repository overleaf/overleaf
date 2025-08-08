import { useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'

export default function GenericErrorAlert({
  className,
}: {
  className?: string
}) {
  const { t } = useTranslation()

  return (
    <OLNotification
      className={className}
      aria-live="polite"
      type="error"
      content={
        <>
          {t('generic_something_went_wrong')}. {t('try_again')}.{' '}
          {t('generic_if_problem_continues_contact_us')}.
        </>
      }
    />
  )
}
