import { Trans, useTranslation } from 'react-i18next'
import { PaidSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { PausedSubscription } from './states/active/paused'
import { ActiveSubscription } from '@/features/subscription/components/dashboard/states/active/active'
import { CanceledSubscription } from './states/canceled'
import { ExpiredSubscription } from './states/expired'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import PersonalSubscriptionSyncEmail from './personal-subscription-sync-email'
import Notification from '@/shared/components/notification'

function PastDueSubscriptionAlert({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()
  return (
    <div className="notification-list">
      <Notification
        type="error"
        content={
          <>
            {t('account_has_past_due_invoice_change_plan_warning')}{' '}
            <a
              href={subscription.payment.accountManagementLink}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('view_your_invoices')}
            </a>
          </>
        }
      />
    </div>
  )
}

function PersonalSubscriptionStates({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()
  const state = subscription?.payment.state

  if (state === 'active' || state === 'past_due') {
    // This version handles subscriptions with and without addons.
    // Stripe subscriptions in dunning have state 'past_due'; Recurly has
    // no equivalent subscription-level state and stays 'active' during
    // dunning, so both are rendered the same way here. The past-due banner
    // rendered above already covers the difference.
    return <ActiveSubscription subscription={subscription} />
  } else if (state === 'canceled') {
    return <CanceledSubscription subscription={subscription} />
  } else if (state === 'expired') {
    return <ExpiredSubscription subscription={subscription} />
  } else if (state === 'paused') {
    return <PausedSubscription subscription={subscription} />
  } else {
    return <>{t('problem_with_subscription_contact_us')}</>
  }
}

function PersonalSubscription() {
  const { t } = useTranslation()
  const { personalSubscription, recurlyLoadError } =
    useSubscriptionDashboardContext()

  if (!personalSubscription) return null

  if (!('payment' in personalSubscription)) {
    return (
      <p>
        <Trans
          i18nKey="please_contact_support_to_makes_change_to_your_plan"
          components={[<a href="/contact" />]} // eslint-disable-line react/jsx-key, jsx-a11y/anchor-has-content
        />
      </p>
    )
  }

  return (
    <>
      {personalSubscription.payment.hasPastDueInvoice && (
        <PastDueSubscriptionAlert subscription={personalSubscription} />
      )}
      <PersonalSubscriptionStates
        subscription={personalSubscription as PaidSubscription}
      />
      {recurlyLoadError && (
        <div className="notification-list">
          <Notification
            type="warning"
            content={<strong>{t('payment_provider_unreachable_error')}</strong>}
          />
        </div>
      )}
      <hr />
      <PersonalSubscriptionSyncEmail />
    </>
  )
}

export default PersonalSubscription
