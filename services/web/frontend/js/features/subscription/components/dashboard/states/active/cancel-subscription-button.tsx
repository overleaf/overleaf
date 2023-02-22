import { useTranslation, Trans } from 'react-i18next'
import * as eventTracking from '../../../../../../infrastructure/event-tracking'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'

export function CancelSubscriptionButton({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()
  const { recurlyLoadError, setShowCancellation } =
    useSubscriptionDashboardContext()

  const stillInATrial =
    subscription.recurly.trialEndsAtFormatted &&
    subscription.recurly.trial_ends_at &&
    new Date(subscription.recurly.trial_ends_at).getTime() > Date.now()

  function handleCancelSubscriptionClick() {
    eventTracking.sendMB('subscription-page-cancel-button-click')
    setShowCancellation(true)
  }

  if (recurlyLoadError) return null

  return (
    <>
      <br />
      <p>
        <button
          className="btn btn-danger"
          onClick={handleCancelSubscriptionClick}
        >
          {t('cancel_your_subscription')}
        </button>
      </p>
      {!stillInATrial && (
        <p>
          <i>
            <Trans
              i18nKey="subscription_will_remain_active_until_end_of_billing_period_x"
              values={{
                terminationDate: subscription.recurly.nextPaymentDueAt,
              }}
              components={[
                // eslint-disable-next-line react/jsx-key
                <strong />,
              ]}
            />
          </i>
        </p>
      )}
    </>
  )
}
