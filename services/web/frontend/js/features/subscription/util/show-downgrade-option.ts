import { Nullable } from '../../../../../types/utils'
import isInFreeTrial from './is-in-free-trial'
import isMonthlyCollaboratorPlan from './is-monthly-collaborator-plan'

export default function showDowngradeOption(
  planCode: string,
  isGroupPlan?: boolean,
  trialEndsAt?: string | null,
  pausedAt?: Nullable<string>,
  remainingPauseCycles?: Nullable<number>
) {
  return (
    !pausedAt &&
    !remainingPauseCycles &&
    isMonthlyCollaboratorPlan(planCode, isGroupPlan) &&
    !isInFreeTrial(trialEndsAt)
  )
}
