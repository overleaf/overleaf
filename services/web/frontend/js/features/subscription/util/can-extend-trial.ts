import freeTrialExpiresUnderSevenDays from './free-trial-expires-under-seven-days'
import isMonthlyCollaboratorPlan from './is-monthly-collaborator-plan'

export default function canExtendTrial(
  planCode: string,
  isGroupPlan?: boolean,
  trialEndsAt?: string | null
) {
  return (
    isMonthlyCollaboratorPlan(planCode, isGroupPlan) &&
    freeTrialExpiresUnderSevenDays(trialEndsAt)
  )
}
