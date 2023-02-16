import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../../../../../../shared/components/loading-spinner'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import { ChangeToGroupPlan } from './change-to-group-plan'
import { ConfirmChangePlanModal } from './confirm-change-plan-modal'
import { IndividualPlansTable } from './individual-plans-table'
import { KeepCurrentPlanModal } from './keep-current-plan-modal'

export function ChangePlan() {
  const { t } = useTranslation()
  const {
    plans,
    queryingIndividualPlansData,
    recurlyLoadError,
    showChangePersonalPlan,
  } = useSubscriptionDashboardContext()

  if (!showChangePersonalPlan || !plans || recurlyLoadError) return null

  if (queryingIndividualPlansData) {
    return (
      <>
        <h2>{t('change_plan')}</h2>
        <LoadingSpinner />
      </>
    )
  } else {
    return (
      <>
        <h2>{t('change_plan')}</h2>
        <IndividualPlansTable plans={plans} />
        <ChangeToGroupPlan />
        <ConfirmChangePlanModal />
        <KeepCurrentPlanModal />
      </>
    )
  }
}
