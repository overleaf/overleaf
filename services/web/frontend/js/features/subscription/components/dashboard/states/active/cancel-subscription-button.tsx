import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import OLButton from '@/shared/components/ol/ol-button'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export function CancelSubscriptionButton() {
  const { t } = useTranslation()
  const {
    recurlyLoadError,
    personalSubscription,
    setModalIdShown,
    setShowCancellation,
  } = useSubscriptionDashboardContext()

  const subscription = personalSubscription as PaidSubscription
  const isInTrial =
    subscription?.payment.trialEndsAtFormatted &&
    subscription?.payment.trialEndsAt &&
    new Date(subscription.payment.trialEndsAt).getTime() > Date.now()
  const hasPendingOrActivePause =
    subscription.payment.state === 'paused' ||
    (subscription.payment.state === 'active' &&
      subscription.payment.remainingPauseCycles &&
      subscription.payment.remainingPauseCycles > 0)
  const planIsEligibleForPause = subscription.payment.isEligibleForPause
  const enablePause =
    useFeatureFlag('pause-subscription') &&
    !hasPendingOrActivePause &&
    planIsEligibleForPause

  function handleCancelSubscriptionClick() {
    eventTracking.sendMB('subscription-page-cancel-button-click', {
      plan_code: subscription?.planCode,
      is_trial: isInTrial,
    })
    if (enablePause) {
      setModalIdShown('pause-subscription')
    } else {
      setShowCancellation(true)
    }
  }

  if (recurlyLoadError) return null

  return (
    <OLButton variant="danger-ghost" onClick={handleCancelSubscriptionClick}>
      {t('cancel_your_subscription')}
    </OLButton>
  )
}
