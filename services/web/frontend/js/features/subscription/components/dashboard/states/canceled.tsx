import { useTranslation, Trans } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../../types/subscription/dashboard/subscription'
import PremiumFeaturesLink from '../premium-features-link'

export function CanceledSubscription({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()

  return (
    <>
      <p>
        <Trans
          i18nKey="currently_subscribed_to_plan"
          values={{
            planName: subscription.plan.name,
          }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>
      <p>
        <Trans
          i18nKey="subscription_canceled_and_terminate_on_x"
          values={{
            terminateDate: subscription.recurly.nextPaymentDueAt,
          }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>
      <PremiumFeaturesLink />
      <p>
        <a
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary-info btn-secondary"
        >
          {t('view_your_invoices')}
        </a>
      </p>
      <form action="/user/subscription/reactivate" method="POST">
        <input type="hidden" name="_csrf" value={window.csrfToken} />
        <button type="submit" className="btn btn-primary">
          {t('reactivate_subscription')}
        </button>
      </form>
    </>
  )
}
