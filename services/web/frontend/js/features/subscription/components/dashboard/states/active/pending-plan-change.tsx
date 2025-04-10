import { Trans } from 'react-i18next'
import { PaidSubscription } from '../../../../../../../../types/subscription/dashboard/subscription'
import { PendingPaymentProviderPlan } from '../../../../../../../../types/subscription/plan'
import { AI_ADD_ON_CODE, ADD_ON_NAME } from '../../../../data/add-on-codes'

export function PendingPlanChange({
  subscription,
}: {
  subscription: PaidSubscription
}) {
  if (!subscription.pendingPlan) return null

  const pendingPlan = subscription.pendingPlan as PendingPaymentProviderPlan

  const hasAiAddon = subscription.addOns?.some(
    addOn => addOn.addOnCode === AI_ADD_ON_CODE
  )

  const pendingAiAddonCancellation =
    hasAiAddon &&
    !pendingPlan.addOns?.some(addOn => addOn.code === AI_ADD_ON_CODE)

  const pendingAdditionalLicenses =
    (subscription.payment.pendingAdditionalLicenses &&
      subscription.payment.pendingAdditionalLicenses > 0) ||
    subscription.payment.additionalLicenses > 0

  return (
    <>
      {subscription.pendingPlan.name !== subscription.plan.name && (
        <Trans
          i18nKey="your_plan_is_changing_at_term_end"
          values={{
            pendingPlanName: subscription.pendingPlan.name,
          }}
          shouldUnescape
          tOptions={{ interpolation: { escapeValue: true } }}
          components={[
            // eslint-disable-next-line react/jsx-key
            <strong />,
          ]}
        />
      )}

      {pendingAdditionalLicenses && (
        <>
          {' '}
          <Trans
            i18nKey="pending_additional_licenses"
            values={{
              pendingAdditionalLicenses:
                subscription.payment.pendingAdditionalLicenses,
              pendingTotalLicenses: subscription.payment.pendingTotalLicenses,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
        </>
      )}

      {pendingAiAddonCancellation && (
        <>
          {' '}
          <Trans
            i18nKey="pending_addon_cancellation"
            values={{
              addOnName: ADD_ON_NAME,
            }}
            shouldUnescape
            tOptions={{ interpolation: { escapeValue: true } }}
            components={{ strong: <strong /> }}
          />
        </>
      )}
    </>
  )
}
