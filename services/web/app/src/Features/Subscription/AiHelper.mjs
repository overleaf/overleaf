// @ts-check
// Initially, this functions lived in PaymentProviderEntities.js,
// but it was moved to this file to prevent circular dependency issue

export const AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE = 'assistant'
export const AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE = 'assistant-annual'
export const AI_ADD_ON_CODE = 'assistant'

/**
 * Returns whether the given plan code is a standalone AI plan
 *
 * @param {string | null | undefined} planCode
 * @return {boolean}
 */
export function isStandaloneAiAddOnPlanCode(planCode) {
  return (
    planCode === AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE ||
    planCode === AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE
  )
}

export default {
  AI_ADD_ON_CODE,
  AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE,
  AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE,
  isStandaloneAiAddOnPlanCode,
}
