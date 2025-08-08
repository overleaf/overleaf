import { useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import OLButton from '@/shared/components/ol/ol-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import isInFreeTrial from '../../../../../util/is-in-free-trial'
import { PaidSubscription } from '../../../../../../../../../types/subscription/dashboard/subscription'

export function ChangeToGroupPlan() {
  const { t } = useTranslation()
  const { handleOpenModal, personalSubscription } =
    useSubscriptionDashboardContext()

  // TODO: Better way to get PaidSubscription/trialEndsAt
  const subscription =
    personalSubscription && 'payment' in personalSubscription
      ? (personalSubscription as PaidSubscription)
      : null
  const isInTrial = isInFreeTrial(subscription?.payment?.trialEndsAt)

  const handleClick = () => {
    handleOpenModal('change-to-group')
  }

  return (
    <div className="card-gray text-center mt-3 p-3">
      <h2 style={{ marginTop: 0 }}>{t('looking_multiple_licenses')}</h2>
      <p style={{ margin: 0 }}>{t('reduce_costs_group_licenses')}</p>
      <br />
      {!subscription?.payment?.isEligibleForGroupPlan ? (
        <>
          <OLTooltip
            id="disabled-change-to-group-plan"
            description={
              isInTrial
                ? t('sorry_you_can_only_change_to_group_from_trial_via_support')
                : t('sorry_you_can_only_change_to_group_via_support')
            }
            overlayProps={{ placement: 'top' }}
          >
            <div>
              <OLButton variant="primary" disabled>
                {t('change_to_group_plan')}
              </OLButton>
            </div>
          </OLTooltip>
        </>
      ) : (
        <OLButton variant="primary" onClick={handleClick}>
          {t('change_to_group_plan')}
        </OLButton>
      )}
    </div>
  )
}
