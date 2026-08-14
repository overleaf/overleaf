import { Trans } from 'react-i18next'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import isInFreeTrial from '../../../../util/is-in-free-trial'
import {
  formatPaymentDate,
  formatPaymentDateTime,
} from '../../../../util/payment-dates'

type SubscriptionRemainderProps = {
  subscription: PaidSubscription
  hideTime?: boolean
}

function SubscriptionRemainder({
  subscription,
  hideTime,
}: SubscriptionRemainderProps) {
  const stillInATrial = isInFreeTrial(subscription.payment.trialEndsAt)

  const terminationDate = hideTime
    ? formatPaymentDate(subscription.payment.periodEnd)
    : formatPaymentDateTime(subscription.payment.periodEnd)
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
