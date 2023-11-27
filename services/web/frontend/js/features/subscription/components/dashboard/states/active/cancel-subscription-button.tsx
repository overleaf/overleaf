import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'

export function CancelSubscriptionButton(
  props: React.ComponentProps<'button'>
) {
  const { t } = useTranslation()
  const { recurlyLoadError, setShowCancellation } =
    useSubscriptionDashboardContext()

  function handleCancelSubscriptionClick() {
    eventTracking.sendMB('subscription-page-cancel-button-click', {})
    setShowCancellation(true)
  }

  if (recurlyLoadError) return null

  return (
    <button onClick={handleCancelSubscriptionClick} {...props}>
      {t('cancel_your_subscription')}
    </button>
  )
}
