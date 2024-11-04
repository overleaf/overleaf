import { Trans } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'

type SubscriptionRemainderProps = {
  subscription: RecurlySubscription
  hideTime?: boolean
}

function SubscriptionRemainder({
  subscription,
  hideTime,
}: SubscriptionRemainderProps) {
  const stillInATrial =
    subscription.recurly.trialEndsAtFormatted &&
    subscription.recurly.trial_ends_at &&
    new Date(subscription.recurly.trial_ends_at).getTime() > Date.now()

  const terminationDate = hideTime
    ? subscription.recurly.nextPaymentDueDate
    : subscription.recurly.nextPaymentDueAt
  return stillInATrial ? (
    <Trans
      i18nKey="subscription_will_remain_active_until_end_of_trial_period_x"
      values={{
        terminationDate,
      }}
      shouldUnescape
      tOptions={{ interpolation: { escapeValue: true } }}
      components={[
        // eslint-disable-next-line react/jsx-key
        <strong />,
      ]}
    />
  ) : (
    <Trans
      i18nKey="subscription_will_remain_active_until_end_of_billing_period_x"
      values={{
        terminationDate,
      }}
      shouldUnescape
      tOptions={{ interpolation: { escapeValue: true } }}
      components={[
        // eslint-disable-next-line react/jsx-key
        <strong />,
      ]}
    />
  )
}

export default SubscriptionRemainder
