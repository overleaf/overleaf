import { Trans } from 'react-i18next'
import { RecurlySubscription } from '../../../../../../../../types/subscription/dashboard/subscription'

export function PendingPlanChange({
  subscription,
}: {
  subscription: RecurlySubscription
}) {
  if (!subscription.pendingPlan) return null

  return (
    <>
      {subscription.pendingPlan.name !== subscription.plan.name && (
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
      )}

      {((subscription.recurly.pendingAdditionalLicenses &&
        subscription.recurly.pendingAdditionalLicenses > 0) ||
        subscription.recurly.additionalLicenses > 0) && (
        <>
          {' '}
          <Trans
            i18nKey="pending_additional_licenses"
            values={{
              pendingAdditionalLicenses:
                subscription.recurly.pendingAdditionalLicenses,
              pendingTotalLicenses: subscription.recurly.pendingTotalLicenses,
            }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
        </>
      )}
    </>
  )
}
