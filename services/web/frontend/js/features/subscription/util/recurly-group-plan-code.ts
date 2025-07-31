export function getRecurlyGroupPlanCode(
  planCode: string,
  size: string,
  usage: string
) {
  return `group_${planCode}_${size}_${usage}`
}

export function getConsolidatedGroupPlanCode(planCode: string, usage: string) {
  if (usage === 'enterprise') {
    return `group_${planCode}`
  }

  return `group_${planCode}_${usage}`
}
