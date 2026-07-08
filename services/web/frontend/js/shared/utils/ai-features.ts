import { AiFeatureLocations, PaywallType } from '../components/types/ai'

export const paywallTypeByLocation: Record<AiFeatureLocations, PaywallType> = {
  workbench: 'workbench',
  errorAssist: 'assistant',
  citationsReviewer: 'citations-reviewer',
}
