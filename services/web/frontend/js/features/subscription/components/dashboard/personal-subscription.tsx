import { Trans, useTranslation } from 'react-i18next'
import { PaidSubscription } from '../../../../../../types/subscription/dashboard/subscription'
import { PausedSubscription } from './states/active/paused'
import { ActiveSubscriptionNew } from '@/features/subscription/components/dashboard/states/active/active-new'
import { CanceledSubscription } from './states/canceled'
import { ExpiredSubscription } from './states/expired'
import { useSubscriptionDashboardContext } from '../../context/subscription-dashboard-context'
import PersonalSubscriptionRecurlySyncEmail from './personal-subscription-recurly-sync-email'
import OLNotification from '@/features/ui/components/ol/ol-notification'

function PastDueSubscriptionAlert({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()
  return (
    <OLNotification
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
  )
}

function RedirectAlerts() {
  const queryParams = new URLSearchParams(window.location.search)
  const redirectReason = queryParams.get('redirect-reason')
  const { t } = useTranslation()

  if (!redirectReason) {
    return null
  }

  let warning
  if (redirectReason === 'writefull-entitled') {
    warning = t('good_news_you_are_already_receiving_this_add_on_via_writefull')
  } else if (redirectReason === 'double-buy') {
    warning = t('good_news_you_already_purchased_this_add_on')
  } else {
    return null
  }

  return <OLNotification type="warning" content={<>{warning}</>} />
}

function PersonalSubscriptionStates({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  const { t } = useTranslation()
  const state = subscription?.payment.state

  if (state === 'active') {
    // This version handles subscriptions with and without addons
    return <ActiveSubscriptionNew subscription={subscription} />
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
      <RedirectAlerts />
      {personalSubscription.payment.hasPastDueInvoice && (
        <PastDueSubscriptionAlert subscription={personalSubscription} />
      )}
      <PersonalSubscriptionStates
        subscription={personalSubscription as PaidSubscription}
      />
      {recurlyLoadError && (
        <OLNotification
          type="warning"
          content={<strong>{t('payment_provider_unreachable_error')}</strong>}
        />
      )}
      <hr />
      <PersonalSubscriptionRecurlySyncEmail />
    </>
  )
}

export default PersonalSubscription
