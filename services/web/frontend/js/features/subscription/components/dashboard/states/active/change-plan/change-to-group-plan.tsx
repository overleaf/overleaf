import { useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import isInFreeTrial from '../../../../../util/is-in-free-trial'
import { RecurlySubscription } from '../../../../../../../../../types/subscription/dashboard/subscription'

export function ChangeToGroupPlan() {
  const { t } = useTranslation()
  const { handleOpenModal, personalSubscription } =
    useSubscriptionDashboardContext()

  // TODO: Better way to get RecurlySubscription/trial_ends_at
  const subscription =
    personalSubscription && 'recurly' in personalSubscription
      ? (personalSubscription as RecurlySubscription)
      : null

  const handleClick = () => {
    handleOpenModal('change-to-group')
  }

  return (
    <div className="card-gray text-center mt-3 p-3">
      <h2 style={{ marginTop: 0 }}>{t('looking_multiple_licenses')}</h2>
      <p style={{ margin: 0 }}>{t('reduce_costs_group_licenses')}</p>
      <br />
      {isInFreeTrial(subscription?.recurly?.trial_ends_at) ? (
        <>
          <OLTooltip
            id="disabled-change-to-group-plan"
            description={t(
              'sorry_you_can_only_change_to_group_from_trial_via_support'
            )}
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
