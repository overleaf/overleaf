export default function isMonthlyCollaboratorPlan(
  planCode: string,
  isGroupPlan?: boolean
) {
  return (
    planCode.indexOf('collaborator') !== -1 &&
    planCode.indexOf('ann') === -1 &&
    !isGroupPlan
  )
}
