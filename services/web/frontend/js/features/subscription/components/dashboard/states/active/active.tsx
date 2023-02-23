import { useTranslation, Trans } from 'react-i18next'
import PremiumFeaturesLink from '../../premium-features-link'
import { PriceExceptions } from '../../../shared/price-exceptions'
import { useSubscriptionDashboardContext } from '../../../../context/subscription-dashboard-context'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { CancelSubscriptionButton } from './cancel-subscription-button'
import { CancelSubscription } from './cancel-plan/cancel-subscription'
import { PendingPlanChange } from './pending-plan-change'
import { TrialEnding } from './trial-ending'
import { ChangePlan } from './change-plan/change-plan'
import { PendingAdditionalLicenses } from './pending-additional-licenses'
import { ContactSupportToChangeGroupPlan } from './contact-support-to-change-group-plan'
import isInFreeTrial from '../../../../util/is-in-free-trial'

export function ActiveSubscription({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  const { t } = useTranslation()
  const { recurlyLoadError, setShowChangePersonalPlan, showCancellation } =
    useSubscriptionDashboardContext()

  if (showCancellation) return <CancelSubscription />

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
        {subscription.pendingPlan && (
          <>
            {' '}
            <PendingPlanChange subscription={subscription} />
          </>
        )}
        {!subscription.pendingPlan &&
          subscription.recurly.additionalLicenses > 0 && (
            <>
              {' '}
              <PendingAdditionalLicenses
                additionalLicenses={subscription.recurly.additionalLicenses}
                totalLicenses={subscription.recurly.totalLicenses}
              />
            </>
          )}
        {!recurlyLoadError &&
          !subscription.groupPlan &&
          subscription.recurly.account.has_past_due_invoice._ !== 'true' && (
            <>
              {' '}
              <button
                className="btn-inline-link"
                onClick={() => setShowChangePersonalPlan(true)}
              >
                {t('change_plan')}
              </button>
            </>
          )}
      </p>
      {subscription.pendingPlan &&
        subscription.pendingPlan.name !== subscription.plan.name && (
          <p>{t('want_change_to_apply_before_plan_end')}</p>
        )}
      {(!subscription.pendingPlan ||
        subscription.pendingPlan.name === subscription.plan.name) &&
        subscription.plan.groupPlan && <ContactSupportToChangeGroupPlan />}
      {isInFreeTrial(subscription.recurly.trial_ends_at) &&
        subscription.recurly.trialEndsAtFormatted && (
          <TrialEnding
            trialEndsAtFormatted={subscription.recurly.trialEndsAtFormatted}
          />
        )}

      <p>
        <Trans
          i18nKey="next_payment_of_x_collectected_on_y"
          values={{
            paymentAmmount: subscription.recurly.displayPrice,
            collectionDate: subscription.recurly.nextPaymentDueAt,
          }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      </p>
      <PremiumFeaturesLink />
      <PriceExceptions subscription={subscription} />
      <p>
        <a
          href={subscription.recurly.billingDetailsLink}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary-info btn-secondary"
        >
          {t('update_your_billing_details')}
        </a>{' '}
        <a
          href={subscription.recurly.accountManagementLink}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary-info btn-secondary"
        >
          {t('view_your_invoices')}
        </a>
      </p>

      {!recurlyLoadError && (
        <CancelSubscriptionButton subscription={subscription} />
      )}

      <ChangePlan />
    </>
  )
}
