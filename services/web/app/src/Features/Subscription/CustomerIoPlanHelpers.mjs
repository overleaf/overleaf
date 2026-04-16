import Settings from '@overleaf/settings'
import { AI_ADD_ON_CODE, isStandaloneAiAddOnPlanCode } from './AiHelper.mjs'
import FeaturesHelper from './FeaturesHelper.mjs'

const INACTIVE_NEXT_RENEWAL_DATE_STATES = new Set([
  'canceled',
  'cancelled',
  'expired',
])
const PENDING_CANCELLATION_STATES = new Set(['canceled', 'cancelled'])

function getSubscriptionState(subscription) {
  return (
    subscription?.recurlyStatus?.state || subscription?.paymentProvider?.state
  )
}

function toUnixTimestamp(dateValue) {
  if (!dateValue) {
    return null
  }

  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return Math.floor(date.getTime() / 1000)
}

function normalizePlanType(bestSubscription) {
  if (!bestSubscription) {
    return null
  }

  if (['standalone-ai-add-on', 'commons'].includes(bestSubscription.type)) {
    return bestSubscription.type
  }

  const planCode = bestSubscription.plan?.planCode
  const isGroupPlan = bestSubscription.plan?.groupPlan === true

  if (!planCode) {
    return bestSubscription.type || null
  }

  if (planCode.startsWith('v1_')) {
    return 'v1'
  }

  if (planCode.includes('student')) {
    return 'student'
  }

  if (planCode.includes('professional')) {
    return isGroupPlan ? 'group-professional' : 'professional'
  }

  if (planCode.includes('collaborator')) {
    return isGroupPlan ? 'group-standard' : 'standard'
  }

  if (planCode.includes('personal')) {
    return 'personal'
  }

  if (isGroupPlan) {
    return 'group-standard'
  }

  return planCode
}

function getFriendlyPlanName(planType) {
  if (!planType) {
    return null
  }

  const friendlyPlanNames = {
    free: 'Free',
    personal: 'Personal',
    standard: 'Standard',
    professional: 'Pro',
    student: 'Student',
    commons: 'Commons',
    'group-standard': 'Group Standard',
    'group-professional': 'Group Pro',
    'standalone-ai-add-on': 'AI Assist add-on',
    v1: 'Legacy',
  }

  if (friendlyPlanNames[planType]) {
    return friendlyPlanNames[planType]
  }

  return planType
}

function getPlanCadence(bestSubscription) {
  if (!bestSubscription?.plan) {
    return null
  }

  return bestSubscription.plan.annual ? 'annual' : 'monthly'
}

function getPlanCadenceFromPlanCode(planCode) {
  if (!planCode) {
    return null
  }

  const plan = Settings.plans.find(candidate => candidate.planCode === planCode)
  if (plan) {
    return plan.annual ? 'annual' : 'monthly'
  }

  if (planCode.includes('annual')) {
    return 'annual'
  }

  if (isStandaloneAiAddOnPlanCode(planCode)) {
    return 'monthly'
  }

  return null
}

function getNextRenewalDateFromPaymentRecord(paymentRecord) {
  const subscriptionState = paymentRecord?.subscription?.state
  if (INACTIVE_NEXT_RENEWAL_DATE_STATES.has(subscriptionState)) {
    return null
  }

  return toUnixTimestamp(paymentRecord?.subscription?.periodEnd)
}

function shouldClearNextRenewalDate(subscription) {
  if (!subscription) {
    return true
  }

  return INACTIVE_NEXT_RENEWAL_DATE_STATES.has(
    getSubscriptionState(subscription)
  )
}

function getExpiryDateFromPaymentRecord(paymentRecord) {
  const subscriptionState = paymentRecord?.subscription?.state
  if (!PENDING_CANCELLATION_STATES.has(subscriptionState)) {
    return null
  }

  const expiryDate = toUnixTimestamp(paymentRecord?.subscription?.periodEnd)
  if (expiryDate == null) {
    return null
  }

  return expiryDate > Math.floor(Date.now() / 1000) ? expiryDate : null
}

function shouldClearExpiryDate(subscription) {
  if (!subscription) {
    return true
  }

  return !PENDING_CANCELLATION_STATES.has(getSubscriptionState(subscription))
}

function hasIndividualAiAssistAddOn(individualSubscription, paymentRecord) {
  if (
    !individualSubscription ||
    individualSubscription.groupPlan ||
    isStandaloneAiAddOnPlanCode(individualSubscription.planCode)
  ) {
    return false
  }

  return Boolean(
    paymentRecord?.subscription?.addOns?.some(
      addOn => addOn.code === AI_ADD_ON_CODE
    )
  )
}

function getAiPlanType(
  bestSubscription,
  individualSubscription,
  paymentRecord,
  writefullData
) {
  if (
    bestSubscription?.type === 'standalone-ai-add-on' ||
    isStandaloneAiAddOnPlanCode(individualSubscription?.planCode)
  ) {
    return 'ai-assist-standalone'
  }

  if (hasIndividualAiAssistAddOn(individualSubscription, paymentRecord)) {
    return 'ai-assist-add-on'
  }

  if (writefullData?.isPremium) {
    return 'writefull-premium'
  }

  return 'none'
}

function getAiPlanCadence(
  aiPlan,
  bestSubscription,
  individualSubscription,
  paymentRecord
) {
  if (aiPlan === 'ai-assist-standalone') {
    return (
      getPlanCadenceFromPlanCode(individualSubscription?.planCode) ||
      getPlanCadenceFromPlanCode(paymentRecord?.subscription?.planCode)
    )
  }

  if (aiPlan === 'ai-assist-add-on') {
    return (
      getPlanCadence(bestSubscription) ||
      getPlanCadenceFromPlanCode(individualSubscription?.planCode)
    )
  }

  return null
}

function hasPlanAiEnabled(plan) {
  if (!plan?.features) {
    return false
  }

  return (
    plan.features.aiUsageQuota === Settings.aiFeatures.unlimitedQuota ||
    plan.features.aiErrorAssistant === true
  )
}

function getGroupAiEnabled(
  memberGroupSubscriptions = [],
  managedGroupSubscriptions = [],
  userIsMemberOfGroupSubscription
) {
  if (!userIsMemberOfGroupSubscription) {
    return null
  }

  const allGroupSubscriptions = [
    ...memberGroupSubscriptions,
    ...managedGroupSubscriptions,
  ]

  return allGroupSubscriptions.some(subscription => {
    const plan = Settings.plans.find(
      candidate => candidate.planCode === subscription.planCode
    )
    return hasPlanAiEnabled(plan)
  })
}

function getGroupSize(
  bestSubscription,
  memberGroupSubscriptions = [],
  managedGroupSubscriptions = []
) {
  const allGroupSubscriptions = [
    ...memberGroupSubscriptions,
    ...managedGroupSubscriptions,
  ]

  if (allGroupSubscriptions.length === 0) {
    return null
  }

  const matchingBestGroupSubscription =
    bestSubscription?.type === 'group'
      ? allGroupSubscriptions.find(
          subscription =>
            subscription.planCode === bestSubscription.plan?.planCode &&
            subscription.teamName === bestSubscription.subscription?.teamName
        )
      : null

  if (matchingBestGroupSubscription?.membersLimit != null) {
    return matchingBestGroupSubscription.membersLimit
  }

  if (bestSubscription?.subscription?.membersLimit != null) {
    return bestSubscription.subscription.membersLimit
  }

  if (
    bestSubscription?.plan?.groupPlan &&
    bestSubscription.plan.membersLimit != null
  ) {
    return bestSubscription.plan.membersLimit
  }

  return allGroupSubscriptions.reduce((largestGroupSize, subscription) => {
    const plan = Settings.plans.find(
      candidate => candidate.planCode === subscription.planCode
    )
    const groupSize = subscription.membersLimit ?? plan?.membersLimit ?? 0

    return Math.max(largestGroupSize, groupSize)
  }, 0)
}

function shouldUseCommonsBestSubscription(
  hasCommons,
  bestSubscription,
  commonsPlan
) {
  if (!hasCommons) {
    return false
  }

  if (bestSubscription == null) {
    return true
  }

  return FeaturesHelper.isFeatureSetBetter(
    commonsPlan?.features || {},
    bestSubscription.plan?.features || {}
  )
}

/**
 * Compute plan-related user properties for sending to customer.io.
 */
function getPlanProperties({
  bestSubscription,
  individualSubscription,
  individualPaymentRecord,
  memberGroupSubscriptions,
  managedGroupSubscriptions,
  userIsMemberOfGroupSubscription,
  writefullData,
}) {
  const planType = normalizePlanType(bestSubscription)
  const displayPlanType = getFriendlyPlanName(planType)
  const planTermLabel = getPlanCadence(bestSubscription)
  const aiPlan = getAiPlanType(
    bestSubscription,
    individualSubscription,
    individualPaymentRecord,
    writefullData
  )
  const aiPlanTermLabel = getAiPlanCadence(
    aiPlan,
    bestSubscription,
    individualSubscription,
    individualPaymentRecord
  )
  const groupAiEnabled = getGroupAiEnabled(
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    userIsMemberOfGroupSubscription
  )
  const nextRenewalDate = getNextRenewalDateFromPaymentRecord(
    individualPaymentRecord
  )
  const expiryDate = getExpiryDateFromPaymentRecord(individualPaymentRecord)
  const groupSizeValue = getGroupSize(
    bestSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions
  )

  const nextRenewalDateTrait =
    nextRenewalDate ??
    (shouldClearNextRenewalDate(individualSubscription) ? '' : undefined)
  const expiryDateTrait =
    expiryDate ??
    (shouldClearExpiryDate(individualSubscription) ? '' : undefined)

  const properties = {
    ai_plan: aiPlan,
  }

  if (planType) properties.plan_type = planType
  if (displayPlanType) properties.display_plan_type = displayPlanType
  if (planTermLabel) properties.plan_term_label = planTermLabel
  if (aiPlanTermLabel) properties.ai_plan_term_label = aiPlanTermLabel
  if (groupAiEnabled !== null) properties.group_ai_enabled = groupAiEnabled
  if (nextRenewalDateTrait !== undefined)
    properties.next_renewal_date = nextRenewalDateTrait
  if (expiryDateTrait !== undefined) properties.expiry_date = expiryDateTrait
  if (groupSizeValue !== null) properties.group_size = groupSizeValue

  return properties
}

export default {
  normalizePlanType,
  getFriendlyPlanName,
  getNextRenewalDateFromPaymentRecord,
  getExpiryDateFromPaymentRecord,
  getAiPlanType,
  getAiPlanCadence,
  hasPlanAiEnabled,
  shouldUseCommonsBestSubscription,
  getPlanProperties,
}
