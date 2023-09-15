import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { getSplitTestVariant } from '../../../../../../../../frontend/js/utils/splitTestUtils'

export function CancelSubscriptionButton(
  props: React.ComponentProps<'button'>
) {
  const { t } = useTranslation()
  const { recurlyLoadError, setShowCancellation } =
    useSubscriptionDashboardContext()

  const designSystemUpdatesVariant = getSplitTestVariant(
    'design-system-updates',
    'default'
  )

  function handleCancelSubscriptionClick() {
    eventTracking.sendMB('subscription-page-cancel-button-click', {
      'split-test-design-system-updates': designSystemUpdatesVariant,
    })
    setShowCancellation(true)
  }

  if (recurlyLoadError) return null

  return (
    <button onClick={handleCancelSubscriptionClick} {...props}>
      {t('cancel_your_subscription')}
    </button>
  )
}
