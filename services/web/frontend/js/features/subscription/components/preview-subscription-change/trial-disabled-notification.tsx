import { useTranslation } from 'react-i18next'
import OLNotification from '@/shared/components/ol/ol-notification'
import getMeta from '@/utils/meta'

export default function TrialDisabledNotification() {
  const { t } = useTranslation()
  const trialDisabledReason = getMeta('ol-trialDisabledReason')

  if (!trialDisabledReason) {
    return null
  }

  return (
    <OLNotification
      className="mb-4"
      aria-live="polite"
      content={t('youre_not_eligible_for_a_free_trial')}
      type="warning"
    />
  )
}
