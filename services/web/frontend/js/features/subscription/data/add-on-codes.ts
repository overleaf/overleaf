import { PaidSubscription } from "../../../../../types/subscription/dashboard/subscription"
import { PendingPaymentProviderPlan } from "../../../../../types/subscription/plan"

export const AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE = 'assistant'
export const AI_ADD_ON_CODE = 'assistant'
// we dont want translations on plan or add-on names
export const ADD_ON_NAME = "AI Assist"
export const AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE = 'assistant-annual'

export function isStandaloneAiPlanCode(planCode?: string) {
  return planCode === AI_ASSIST_STANDALONE_MONTHLY_PLAN_CODE || planCode === AI_ASSIST_STANDALONE_ANNUAL_PLAN_CODE
}



export function hasPendingAiAddonCancellation(subscription: PaidSubscription){

  const pendingPlan = subscription.pendingPlan as PendingPaymentProviderPlan

  const hasAiAddon = subscription.addOns?.some(
    addOn => addOn.addOnCode === AI_ADD_ON_CODE
  )

  // cancellation of entire plan counts as removing the add-on
  if(hasAiAddon && !pendingPlan){
    return true
  }

  return hasAiAddon &&
    !pendingPlan.addOns?.some(addOn => addOn.code === AI_ADD_ON_CODE)
    
}