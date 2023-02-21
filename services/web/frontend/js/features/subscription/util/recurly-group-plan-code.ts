export function getRecurlyGroupPlanCode(
  planCode: string,
  size: string,
  usage: string
) {
  return `group_${planCode}_${size}_${usage}`
}
