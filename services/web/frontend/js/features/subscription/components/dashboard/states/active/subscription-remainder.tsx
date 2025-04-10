import { Trans } from 'react-i18next'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'

type SubscriptionRemainderProps = {
  subscription: PaidSubscription
  hideTime?: boolean
}

function SubscriptionRemainder({
  subscription,
  hideTime,
}: SubscriptionRemainderProps) {
  const stillInATrial =
    subscription.payment.trialEndsAtFormatted &&
    subscription.payment.trialEndsAt &&
    new Date(subscription.payment.trialEndsAt).getTime() > Date.now()

  const terminationDate = hideTime
    ? subscription.payment.nextPaymentDueDate
    : subscription.payment.nextPaymentDueAt
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
