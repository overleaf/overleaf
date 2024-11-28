export const AI_STANDALONE_PLAN_CODE = 'assistant'
export const AI_ADD_ON_CODE = 'assistant'
// we dont want translations on plan or add-on names
export const ADD_ON_NAME = "Error Assist"
export const AI_STANDALONE_ANNUAL_PLAN_CODE = 'assistant-annual'

export function isStandaloneAiPlanCode(planCode: string) {
  return planCode === AI_STANDALONE_PLAN_CODE || planCode === AI_STANDALONE_ANNUAL_PLAN_CODE
}
