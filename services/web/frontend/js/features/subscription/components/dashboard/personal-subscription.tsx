import { useTranslation } from 'react-i18next'
import { Subscription } from '../../../../../../types/subscription/dashboard/subscription'
import { ActiveSubscription } from './states/active/active'
import { CanceledSubscription } from './states/canceled'
import { ExpiredSubscription } from './states/expired'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'

function PastDueSubscriptionAlert({
  subscription,
}: {
  subscription: Subscription
}) {
  const { t } = useTranslation()
  return (
    <>
      <div className="alert alert-danger" role="alert">
        {t('account_has_past_due_invoice_change_plan_warning')}{' '}
        <a
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noreferrer noopener"
        >
          {t('view_your_invoices')}
        </a>
      </div>
    </>
  )
}

function PersonalSubscriptionStates({
  subscription,
}: {
  subscription: Subscription
}) {
  const { t } = useTranslation()
  const state = subscription?.recurly?.state

  if (state === 'active') {
    return <ActiveSubscription subscription={subscription} />
  } else if (state === 'canceled') {
    return <CanceledSubscription subscription={subscription} />
  } else if (state === 'expired') {
    return <ExpiredSubscription subscription={subscription} />
  } else {
    return <>{t('problem_with_subscription_contact_us')}</>
  }
}

function PersonalSubscription() {
  const { t } = useTranslation()
  const { personalSubscription, recurlyLoadError } =
    useSubscriptionDashboardContext()

  if (!personalSubscription) return null

  return (
    <>
      {personalSubscription.recurly.account.has_past_due_invoice._ ===
        'true' && (
        <PastDueSubscriptionAlert subscription={personalSubscription} />
      )}
      <PersonalSubscriptionStates subscription={personalSubscription} />
      {recurlyLoadError && (
        <div className="alert alert-warning" role="alert">
          <strong>{t('payment_provider_unreachable_error')}</strong>
        </div>
      )}
      <hr />
    </>
  )
}

export default PersonalSubscription
