// @ts-check
import Settings from '@overleaf/settings'
import { AI_ADD_ON_CODE, isStandaloneAiAddOnPlanCode } from './AiHelper.mjs'
import FeaturesHelper from './FeaturesHelper.mjs'

/**
 * @typedef {InstanceType<typeof import('../../models/Subscription.mjs').Subscription>} MongoSubscription
 * @typedef {import('../../../../types/subscription/plan').Plan} Plan
 * @typedef {import('../../../../modules/subscriptions/app/src/PaymentService.mjs').PaymentRecord} PaymentRecord
 * @typedef {import('../../../../types/user-email').UserEmailData} UserEmailData
 */

/**
 * @template T
 * @typedef {T | null} Nullable
 */

/**
 * Subset of the "best subscription" object from
 * SubscriptionViewModelBuilder.buildUsersSubscriptionViewModel
 *
 * @typedef {object} BestSubscription
 * @property {'free' | 'individual' | 'group' | 'commons' | 'standalone-ai-add-on'} [type]
 * @property {Partial<Plan>} [plan]
 * @property {{ teamName?: string, membersLimit?: number }} [subscription]
 * @property {number} [remainingTrialDays]
 */

const INACTIVE_NEXT_RENEWAL_DATE_STATES = new Set([
  'canceled',
  'cancelled',
  'expired',
])
const PENDING_CANCELLATION_STATES = new Set(['canceled', 'cancelled'])

/**
 * @param {Nullable<MongoSubscription>} [subscription]
 * @returns {string}
 */
function getSubscriptionState(subscription) {
  return (
    subscription?.recurlyStatus?.state ||
    subscription?.paymentProvider?.state ||
    ''
  )
}

/**
 * @param {Nullable<Date | string | number>} [dateValue]
 * @returns {number | null}
 */
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

/**
 * @param {Nullable<BestSubscription>} [bestSubscription]
 * @returns {string}
 */
function normalizePlanType(bestSubscription) {
  if (!bestSubscription) {
    return ''
  }

  if (
    bestSubscription.type === 'standalone-ai-add-on' ||
    bestSubscription.type === 'commons'
  ) {
    return bestSubscription.type
  }

  const planCode = bestSubscription.plan?.planCode
  const isGroupPlan = bestSubscription.plan?.groupPlan === true

  if (!planCode) {
    return bestSubscription.type || ''
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

/**
 * @param {Nullable<string>} [planCode]
 * @returns {string}
 */
function normalizePlanTypeFromPlanCode(planCode) {
  if (!planCode) {
    return ''
  }
  const plan = /** @type {Plan[]} */ (Settings.plans).find(
    candidate => candidate.planCode === planCode
  )
  return normalizePlanType({
    plan: {
      planCode,
      groupPlan: plan?.groupPlan === true,
    },
  })
}

/**
 * @param {Nullable<string>} [planType]
 * @returns {string}
 */
function getFriendlyPlanName(planType) {
  if (!planType) {
    return ''
  }

  /** @type {Record<string, string>} */
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

/**
 * @param {Nullable<BestSubscription>} [bestSubscription]
 * @returns {'annual' | 'monthly' | null}
 */
function getPlanCadence(bestSubscription) {
  if (!bestSubscription?.plan) {
    return null
  }

  return bestSubscription.plan.annual ? 'annual' : 'monthly'
}

/**
 * @param {Nullable<string>} [planCode]
 * @returns {'annual' | 'monthly' | null}
 */
function getPlanCadenceFromPlanCode(planCode) {
  if (!planCode) {
    return null
  }

  const plan = /** @type {Plan[]} */ (Settings.plans).find(
    candidate => candidate.planCode === planCode
  )
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

/**
 * @param {Nullable<PaymentRecord>} [paymentRecord]
 * @returns {number | null}
 */
function getNextRenewalDateFromPaymentRecord(paymentRecord) {
  const subscriptionState = paymentRecord?.subscription?.state
  if (
    subscriptionState &&
    INACTIVE_NEXT_RENEWAL_DATE_STATES.has(subscriptionState)
  ) {
    return null
  }

  return toUnixTimestamp(paymentRecord?.subscription?.periodEnd)
}

/**
 * @param {Nullable<MongoSubscription>} [subscription]
 * @returns {boolean}
 */
function shouldClearNextRenewalDate(subscription) {
  if (!subscription) {
    return true
  }

  return INACTIVE_NEXT_RENEWAL_DATE_STATES.has(
    getSubscriptionState(subscription)
  )
}

/**
 * @param {Nullable<PaymentRecord>} [paymentRecord]
 * @returns {number | null}
 */
function getExpiryDateFromPaymentRecord(paymentRecord) {
  const subscriptionState = paymentRecord?.subscription?.state
  if (
    subscriptionState == null ||
    !PENDING_CANCELLATION_STATES.has(subscriptionState)
  ) {
    return null
  }

  const expiryDate = toUnixTimestamp(paymentRecord?.subscription?.periodEnd)
  if (expiryDate == null) {
    return null
  }

  return expiryDate > Math.floor(Date.now() / 1000) ? expiryDate : null
}

/**
 * @param {Nullable<MongoSubscription>} [subscription]
 * @returns {boolean}
 */
function shouldClearExpiryDate(subscription) {
  if (!subscription) {
    return true
  }

  return !PENDING_CANCELLATION_STATES.has(getSubscriptionState(subscription))
}

/**
 * @param {Nullable<MongoSubscription>} [individualSubscription]
 * @returns {number | null}
 */
function getTrialEndDate(individualSubscription) {
  const trialEndsAt =
    individualSubscription?.recurlyStatus?.trialEndsAt ||
    individualSubscription?.paymentProvider?.trialEndsAt
  return toUnixTimestamp(trialEndsAt)
}

/**
 * @param {Nullable<MongoSubscription>} [individualSubscription]
 * @param {Nullable<PaymentRecord>} [paymentRecord]
 * @returns {boolean}
 */
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

/**
 * @param {Nullable<BestSubscription>} [bestSubscription]
 * @param {Nullable<MongoSubscription>} [individualSubscription]
 * @param {Nullable<PaymentRecord>} [paymentRecord]
 * @param {Nullable<{ isPremium?: boolean }>} [writefullData]
 * @returns {'ai-assist-standalone' | 'ai-assist-add-on' | 'writefull-premium' | 'none'}
 */
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

/**
 * @param {Nullable<string>} [aiPlan]
 * @param {Nullable<BestSubscription>} [bestSubscription]
 * @param {Nullable<MongoSubscription>} [individualSubscription]
 * @param {Nullable<PaymentRecord>} [paymentRecord]
 * @returns {'annual' | 'monthly' | null}
 */
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

/**
 * @param {Nullable<Partial<Plan>>} [plan]
 * @returns {boolean}
 */
function hasPlanAiEnabled(plan) {
  if (!plan?.features) {
    return false
  }

  return (
    plan.features.aiUsageQuota === Settings.aiFeatures.unlimitedQuota ||
    plan.features.aiErrorAssistant === true
  )
}

/**
 * @param {MongoSubscription[]} [memberGroupSubscriptions]
 * @param {MongoSubscription[]} [managedGroupSubscriptions]
 * @param {boolean} [userIsMemberOfGroupSubscription]
 * @param {Map<string, boolean>} [aiBlockedByPolicyId]
 * @returns {boolean | null}
 */
function getGroupAiEnabled(
  memberGroupSubscriptions = [],
  managedGroupSubscriptions = [],
  userIsMemberOfGroupSubscription,
  aiBlockedByPolicyId = new Map()
) {
  if (!userIsMemberOfGroupSubscription) {
    return null
  }

  const allGroupSubscriptions = [
    ...memberGroupSubscriptions,
    ...managedGroupSubscriptions,
  ]

  const someBlocked = allGroupSubscriptions.some(subscription => {
    const policyId = subscription.groupPolicy?.toString()
    return policyId ? aiBlockedByPolicyId.get(policyId) : false
  })

  return !someBlocked
}

/**
 * @param {Nullable<BestSubscription>} [bestSubscription]
 * @param {MongoSubscription[]} [memberGroupSubscriptions]
 * @param {MongoSubscription[]} [managedGroupSubscriptions]
 * @returns {number | null}
 */
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
    const plan = /** @type {Plan[]} */ (Settings.plans).find(
      candidate => candidate.planCode === subscription.planCode
    )
    const groupSize = subscription.membersLimit ?? plan?.membersLimit ?? 0

    return Math.max(largestGroupSize, groupSize)
  }, 0)
}

/**
 * @param {Nullable<MongoSubscription>} [individualSubscription]
 * @param {MongoSubscription[]} [memberGroupSubscriptions]
 * @param {MongoSubscription[]} [managedGroupSubscriptions]
 * @returns {'stripe' | 'recurly' | null}
 */
function getPaymentProvider(
  individualSubscription,
  memberGroupSubscriptions = [],
  managedGroupSubscriptions = []
) {
  const candidates = /** @type {MongoSubscription[]} */ (
    [
      individualSubscription,
      ...memberGroupSubscriptions,
      ...managedGroupSubscriptions,
    ].filter(Boolean)
  )

  if (candidates.length === 0) {
    return null
  }

  for (const candidate of candidates) {
    const service = candidate.paymentProvider?.service
    if (service) {
      return service.includes('stripe') ? 'stripe' : 'recurly'
    }
  }

  return 'recurly'
}

/**
 * @param {boolean} hasCommons
 * @param {Nullable<BestSubscription>} [bestSubscription]
 * @param {Nullable<Partial<Plan>>} [commonsPlan]
 * @returns {boolean}
 */
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
 * Determine the user's role in any group subscription they participate in.
 *
 * @param {MongoSubscription[]} memberGroupSubscriptions
 * @param {MongoSubscription[]} managedGroupSubscriptions
 * @param {string|object} userId
 * @returns {''|'admin'|'manager'|'member'}
 */
function getGroupRole(
  memberGroupSubscriptions = [],
  managedGroupSubscriptions = [],
  userId
) {
  if (
    managedGroupSubscriptions.length === 0 &&
    memberGroupSubscriptions.length === 0
  ) {
    return ''
  }
  const userIdStr = userId.toString()
  const isAdmin = managedGroupSubscriptions.some(
    sub => sub.admin_id?._id?.toString() === userIdStr
  )
  if (isAdmin) return 'admin'
  if (managedGroupSubscriptions.length > 0) return 'manager'
  return 'member'
}

/**
 * Customer.io properties derived from a user's institutional affiliations.
 *
 * @param {UserEmailData[]} userEmails - email data from UserGetter.getUserFullEmails
 * @returns {{ enterprise_commons: boolean, domain_capture: boolean }}
 */
function getAffiliationProperties(userEmails) {
  const enterpriseCommons = userEmails.some(
    emailData =>
      emailData.emailHasInstitutionLicence &&
      emailData.affiliation?.institution?.commonsAccount &&
      emailData.affiliation?.institution?.enterpriseCommons
  )
  const domainCapture = userEmails.some(
    emailData => emailData.affiliation?.group?.domainCaptureEnabled
  )
  return {
    enterprise_commons: enterpriseCommons,
    domain_capture: domainCapture,
  }
}

/**
 * Compute plan-related user properties for sending to customer.io.
 *
 * @param {object} options
 * @param {BestSubscription} options.bestSubscription
 * @param {Nullable<MongoSubscription>} [options.individualSubscription]
 * @param {Nullable<PaymentRecord>} [options.individualPaymentRecord]
 * @param {MongoSubscription[]} [options.memberGroupSubscriptions]
 * @param {MongoSubscription[]} [options.managedGroupSubscriptions]
 * @param {boolean} options.userIsMemberOfGroupSubscription
 * @param {boolean} options.hasCommons
 * @param {Nullable<{ isPremium?: boolean }>} [options.writefullData]
 * @param {Map<string, boolean>} [options.aiBlockedByPolicyId]
 * @param {string|object} options.userId
 */
function getPlanProperties({
  bestSubscription,
  individualSubscription,
  individualPaymentRecord,
  memberGroupSubscriptions,
  managedGroupSubscriptions,
  userIsMemberOfGroupSubscription,
  hasCommons,
  writefullData,
  aiBlockedByPolicyId,
  userId,
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
    userIsMemberOfGroupSubscription,
    aiBlockedByPolicyId
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

  const trialEndDate = getTrialEndDate(individualSubscription)

  /** @type {Record<string, unknown>} */
  const properties = {
    ai_plan: aiPlan,
    group: userIsMemberOfGroupSubscription,
    group_role: getGroupRole(
      memberGroupSubscriptions,
      managedGroupSubscriptions,
      userId
    ),
    commons: Boolean(hasCommons),
    individual_subscription: Boolean(
      individualSubscription && !individualSubscription.groupPlan
    ),
    past_due: getSubscriptionState(individualSubscription) === 'past_due',
  }

  if (trialEndDate != null) properties.trial_end_date = trialEndDate

  const paymentProvider = getPaymentProvider(
    individualSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions
  )
  if (paymentProvider) properties.payment_provider = paymentProvider

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
  normalizePlanTypeFromPlanCode,
  getFriendlyPlanName,
  getNextRenewalDateFromPaymentRecord,
  getExpiryDateFromPaymentRecord,
  getAiPlanType,
  getAiPlanCadence,
  hasPlanAiEnabled,
  shouldUseCommonsBestSubscription,
  getGroupRole,
  getPlanProperties,
  getAffiliationProperties,
}
