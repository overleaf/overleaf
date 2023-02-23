import isInFreeTrial from './is-in-free-trial'
import isMonthlyCollaboratorPlan from './is-monthly-collaborator-plan'

export default function showDowngradeOption(
  planCode: string,
  isGroupPlan?: boolean,
  trialEndsAt?: string | null
) {
  return (
    isMonthlyCollaboratorPlan(planCode, isGroupPlan) &&
    !isInFreeTrial(trialEndsAt)
  )
}
