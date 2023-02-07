import { useTranslation } from 'react-i18next'
import { useSubscriptionDashboardContext } from '../../../../../context/subscription-dashboard-context'
import { ChangeToGroupPlan } from './change-to-group-plan'
import { IndividualPlansTable } from './individual-plans-table'

export function ChangePlan() {
  const { t } = useTranslation()
  const { plans, recurlyLoadError, showChangePersonalPlan } =
    useSubscriptionDashboardContext()

  if (!showChangePersonalPlan || !plans || recurlyLoadError) return null

  return (
    <>
      <h2>{t('change_plan')}</h2>
      <IndividualPlansTable plans={plans} />
      <ChangeToGroupPlan />
    </>
  )
}
