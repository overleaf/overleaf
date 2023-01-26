import { useTranslation, Trans } from 'react-i18next'
import PremiumFeaturesLink from '../premium-features-link'
import { PriceExceptions } from '../../shared/price-exceptions'
import { useSubscriptionDashboardContext } from '../../../context/subscription-dashboard-context'
import { Subscription } from '../../../../../../../types/subscription/dashboard/subscription'

function ChangePlan() {
  const { t } = useTranslation()
  const { showChangePersonalPlan } = useSubscriptionDashboardContext()

  if (!showChangePersonalPlan) return null

  return (
    <>
      <h2>{t('change_plan')}</h2>
      <p>
        <strong>TODO: change subscription placeholder</strong>
      </p>
    </>
  )
}

export function ActiveSubsciption({
  subscription,
}: {
  subscription: Subscription
}) {
  const { t } = useTranslation()
  const { setShowChangePersonalPlan } = useSubscriptionDashboardContext()

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
        {subscription.pendingPlan &&
          subscription.pendingPlan.name !== subscription.plan.name && (
            <>
              {' '}
              <Trans
                i18nKey="your_plan_is_changing_at_term_end"
                values={{
                  pendingPlanName: subscription.pendingPlan.name,
                }}
                components={[
                  // eslint-disable-next-line react/jsx-key
                  <strong />,
                ]}
              />
            </>
          )}{' '}
        {/* TODO: pending_additional_licenses */}
        {/* TODO: additionalLicenses */}
        <button
          className="btn-inline-link"
          onClick={() => setShowChangePersonalPlan(true)}
        >
          {t('change_plan')}
        </button>
      </p>
      {subscription.pendingPlan && (
        <p>{t('want_change_to_apply_before_plan_end')}</p>
      )}
      {/* TODO: groupPlan */}
      {/* TODO: trialEndsAtFormatted */}
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
      <PriceExceptions />
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
      </a>{' '}
      {/* TODO:  cancel button */}
      <ChangePlan />
    </>
  )
}
