import getMeta from '@/utils/meta'
import { AiFeatureLocations, PaywallType } from '../components/types/ai'

export const paywallTypeByLocation: Record<AiFeatureLocations, PaywallType> = {
  workbench: 'workbench',
  errorAssist: 'assistant',
  citationsReviewer: 'citations-reviewer',
}

// Returns the plan type for a limit with no upgrade path, or null when an
// upgrade is offered. Membership is checked before quota so commons/group users
// with unlimited AI aren't reported as individual; group before commons matches
// the rendered paywall's precedence for users who are in both.
export function getAiPlanTypeWithoutUpgrade(
  hasUnlimitedQuota: boolean
): 'commons' | 'group' | 'individual' | null {
  const { hasInstitutionLicence, isMemberOfGroupSubscription } =
    getMeta('ol-user')
  if (isMemberOfGroupSubscription) {
    return 'group'
  }
  if (hasInstitutionLicence) {
    return 'commons'
  }
  if (hasUnlimitedQuota) {
    return 'individual'
  }
  return null
}
