import { useTranslation } from 'react-i18next'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { useFeatureFlag } from '@/shared/context/split-test-context'

export function CancelSubscriptionButton() {
  const { t } = useTranslation()
  const {
    recurlyLoadError,
    personalSubscription,
    setModalIdShown,
    setShowCancellation,
  } = useSubscriptionDashboardContext()

  const subscription = personalSubscription as RecurlySubscription
  const isInTrial =
    subscription?.recurly.trialEndsAtFormatted &&
    subscription?.recurly.trial_ends_at &&
    new Date(subscription.recurly.trial_ends_at).getTime() > Date.now()
  const hasPendingOrActivePause =
    subscription.recurly.state === 'paused' ||
    (subscription.recurly.state === 'active' &&
      subscription.recurly.remainingPauseCycles &&
      subscription.recurly.remainingPauseCycles > 0)
  const planIsEligibleForPause =
    !subscription.pendingPlan &&
    !subscription.groupPlan &&
    !isInTrial &&
    !subscription.planCode.includes('ann') &&
    !subscription.addOns?.length
  const enablePause =
    useFeatureFlag('pause-subscription') &&
    !hasPendingOrActivePause &&
    planIsEligibleForPause

  function handleCancelSubscriptionClick() {
    eventTracking.sendMB('subscription-page-cancel-button-click', {
      plan_code: subscription?.planCode,
      is_trial: isInTrial,
    })
    if (enablePause) setModalIdShown('pause-subscription')
    else setShowCancellation(true)
  }

  if (recurlyLoadError) return null

  return (
    <OLButton variant="danger-ghost" onClick={handleCancelSubscriptionClick}>
      {t('cancel_your_subscription')}
    </OLButton>
  )
}
