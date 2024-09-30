import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import OLButton from '@/features/ui/components/ol/ol-button'

export function CancelSubscriptionButton() {
  const { t } = useTranslation()
  const { recurlyLoadError, setShowCancellation } =
    useSubscriptionDashboardContext()

  function handleCancelSubscriptionClick() {
    eventTracking.sendMB('subscription-page-cancel-button-click', {})
    setShowCancellation(true)
  }

  if (recurlyLoadError) return null

  return (
    <OLButton variant="danger-ghost" onClick={handleCancelSubscriptionClick}>
      {t('cancel_your_subscription')}
    </OLButton>
  )
}
