import { useTranslation } from 'react-i18next'
import LoadingSpinner from '../../../../../../../shared/components/loading-spinner'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import { ChangeToGroupPlan } from './change-to-group-plan'
import { ConfirmChangePlanModal } from './modals/confirm-change-plan-modal'
import { IndividualPlansTable } from './individual-plans-table'
import { KeepCurrentPlanModal } from './modals/keep-current-plan-modal'
import { ChangeToGroupModal } from './modals/change-to-group-modal'

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
        <ChangeToGroupModal />
      </>
    )
  }
}
