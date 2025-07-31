// @ts-check
// Initially, this functions lived in PaymentProviderEntities.js,
// but it was moved to this file to prevent circular dependency issue

const AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE = 'assistant'
const AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE = 'assistant-annual'
const AI_ADD_ON_CODE = 'assistant'

/**
 * Returns whether the given plan code is a standalone AI plan
 *
 * @param {string} planCode
 * @return {boolean}
 */
function isStandaloneAiAddOnPlanCode(planCode) {
  return (
    planCode === AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE ||
    planCode === AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE
  )
}

/**
 * Returns whether subscription change will have have the ai bundle once the change is processed
 *
 * @param {Object} subscriptionChange The subscription change object coming from payment provider
 * type should be PaymentProviderSubscriptionChange but if imported here, it creates a circular dependency
 * TODO: fix this when moved to es modules
 *
 * @return {boolean}
 */
function subscriptionChangeIsAiAssistUpgrade(subscriptionChange) {
  return Boolean(
    isStandaloneAiAddOnPlanCode(subscriptionChange.nextPlanCode) ||
      subscriptionChange.nextAddOns?.some(
        addOn => addOn.code === AI_ADD_ON_CODE
      )
  )
}

module.exports = {
  AI_ADD_ON_CODE,
  AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE,
  AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE,
  isStandaloneAiAddOnPlanCode,
  subscriptionChangeIsAiAssistUpgrade,
}
