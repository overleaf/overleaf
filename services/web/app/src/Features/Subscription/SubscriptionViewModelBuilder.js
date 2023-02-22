const Settings = require('@overleaf/settings')
const RecurlyWrapper = require('./RecurlyWrapper')
const PlansLocator = require('./PlansLocator')
const SubscriptionFormatters = require('./SubscriptionFormatters')
const SubscriptionLocator = require('./SubscriptionLocator')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const InstitutionsGetter = require('../Institutions/InstitutionsGetter')
const InstitutionsManager = require('../Institutions/InstitutionsManager')
const PublishersGetter = require('../Publishers/PublishersGetter')
const sanitizeHtml = require('sanitize-html')
const _ = require('underscore')
const async = require('async')
const SubscriptionHelper = require('./SubscriptionHelper')
const { callbackify } = require('../../util/promises')
const {
  InvalidError,
  NotFoundError,
  V1ConnectionError,
} = require('../Errors/Errors')
const FeaturesHelper = require('./FeaturesHelper')

/** @typedef {import("../../../../types/project/dashboard/subscription").Subscription} Subscription */

function buildHostedLink(type) {
  return `/user/subscription/recurly/${type}`
}

// Downgrade from Mongoose object, so we can add custom attributes to object
function serializeMongooseObject(object) {
  return object && typeof object.toObject === 'function'
    ? object.toObject()
    : object
}

async function getRedirectToHostedPage(userId, pageType) {
  if (!['billing-details', 'account-management'].includes(pageType)) {
    throw new InvalidError('unexpected page type')
  }
  const personalSubscription =
    await SubscriptionLocator.promises.getUsersSubscription(userId)
  const recurlySubscriptionId = personalSubscription?.recurlySubscription_id
  if (!recurlySubscriptionId) {
    throw new NotFoundError('not a recurly subscription')
  }
  const recurlySubscription = await RecurlyWrapper.promises.getSubscription(
    recurlySubscriptionId,
    { includeAccount: true }
  )

  const recurlySubdomain = Settings.apis.recurly.subdomain
  const hostedLoginToken = recurlySubscription.account.hosted_login_token
  if (!hostedLoginToken) {
    throw new Error('recurly account does not have hosted login token')
  }
  let path = ''
  if (pageType === 'billing-details') {
    path = 'billing_info/edit?ht='
  }
  return [
    'https://',
    recurlySubdomain,
    '.recurly.com/account/',
    path,
    hostedLoginToken,
  ].join('')
}

async function buildUsersSubscriptionViewModel(user) {
  let {
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
    v1SubscriptionStatus,
    recurlySubscription,
    recurlyCoupons,
    plan,
  } = await async.auto({
    personalSubscription(cb) {
      SubscriptionLocator.getUsersSubscription(user, cb)
    },
    recurlySubscription: [
      'personalSubscription',
      ({ personalSubscription }, cb) => {
        if (
          personalSubscription == null ||
          personalSubscription.recurlySubscription_id == null ||
          personalSubscription.recurlySubscription_id === ''
        ) {
          return cb(null, null)
        }
        RecurlyWrapper.getSubscription(
          personalSubscription.recurlySubscription_id,
          { includeAccount: true },
          cb
        )
      },
    ],
    recurlyCoupons: [
      'recurlySubscription',
      ({ recurlySubscription }, cb) => {
        if (!recurlySubscription) {
          return cb(null, null)
        }
        const accountId = recurlySubscription.account.account_code
        RecurlyWrapper.getAccountActiveCoupons(accountId, cb)
      },
    ],
    plan: [
      'personalSubscription',
      ({ personalSubscription }, cb) => {
        if (personalSubscription == null) {
          return cb()
        }
        const plan = PlansLocator.findLocalPlanInSettings(
          personalSubscription.planCode
        )
        if (plan == null) {
          return cb(
            new Error(
              `No plan found for planCode '${personalSubscription.planCode}'`
            )
          )
        }
        cb(null, plan)
      },
    ],
    memberGroupSubscriptions(cb) {
      SubscriptionLocator.getMemberSubscriptions(user, cb)
    },
    managedGroupSubscriptions(cb) {
      SubscriptionLocator.getManagedGroupSubscriptions(user, cb)
    },
    currentInstitutionsWithLicence(cb) {
      InstitutionsGetter.getCurrentInstitutionsWithLicence(
        user._id,
        (error, institutions) => {
          if (error instanceof V1ConnectionError) {
            return cb(null, false)
          }
          cb(null, institutions)
        }
      )
    },
    managedInstitutions(cb) {
      InstitutionsGetter.getManagedInstitutions(user._id, cb)
    },
    managedPublishers(cb) {
      PublishersGetter.getManagedPublishers(user._id, cb)
    },
    v1SubscriptionStatus(cb) {
      V1SubscriptionManager.getSubscriptionStatusFromV1(
        user._id,
        (error, status, v1Id) => {
          if (error) {
            return cb(error)
          }
          cb(null, status)
        }
      )
    },
  })

  if (memberGroupSubscriptions == null) {
    memberGroupSubscriptions = []
  }
  if (managedGroupSubscriptions == null) {
    managedGroupSubscriptions = []
  }
  if (managedInstitutions == null) {
    managedInstitutions = []
  }
  if (v1SubscriptionStatus == null) {
    v1SubscriptionStatus = {}
  }
  if (recurlyCoupons == null) {
    recurlyCoupons = []
  }

  personalSubscription = serializeMongooseObject(personalSubscription)
  memberGroupSubscriptions = memberGroupSubscriptions.map(
    serializeMongooseObject
  )
  managedGroupSubscriptions = managedGroupSubscriptions.map(
    serializeMongooseObject
  )
  managedInstitutions = managedInstitutions.map(serializeMongooseObject)
  await Promise.all(
    managedInstitutions.map(InstitutionsManager.promises.fetchV1Data)
  )
  managedPublishers = managedPublishers.map(serializeMongooseObject)
  await Promise.all(
    managedPublishers.map(PublishersGetter.promises.fetchV1Data)
  )

  if (plan != null) {
    personalSubscription.plan = plan
  }

  // Subscription DB object contains a recurly property, used to cache trial info
  // on the project-list. However, this can cause the wrong template to render,
  // if we do not have any subscription data from Recurly (recurlySubscription)
  // TODO: Delete this workaround once recurly cache property name migration rolled out.
  if (personalSubscription) {
    delete personalSubscription.recurly
  }

  if (personalSubscription && recurlySubscription) {
    const tax = recurlySubscription.tax_in_cents || 0
    // Some plans allow adding more seats than the base plan provides.
    // This is recorded as a subscription add on.
    // Note: tax_in_cents already includes the tax for any addon.
    let addOnPrice = 0
    let additionalLicenses = 0
    if (
      plan.membersLimitAddOn &&
      Array.isArray(recurlySubscription.subscription_add_ons)
    ) {
      recurlySubscription.subscription_add_ons.forEach(addOn => {
        if (addOn.add_on_code === plan.membersLimitAddOn) {
          addOnPrice += addOn.quantity * addOn.unit_amount_in_cents
          additionalLicenses += addOn.quantity
        }
      })
    }
    const totalLicenses = (plan.membersLimit || 0) + additionalLicenses
    personalSubscription.recurly = {
      tax,
      taxRate: recurlySubscription.tax_rate
        ? parseFloat(recurlySubscription.tax_rate._)
        : 0,
      billingDetailsLink: buildHostedLink('billing-details'),
      accountManagementLink: buildHostedLink('account-management'),
      additionalLicenses,
      totalLicenses,
      nextPaymentDueAt: SubscriptionFormatters.formatDate(
        recurlySubscription.current_period_ends_at
      ),
      currency: recurlySubscription.currency,
      state: recurlySubscription.state,
      trialEndsAtFormatted: SubscriptionFormatters.formatDate(
        recurlySubscription.trial_ends_at
      ),
      trial_ends_at: recurlySubscription.trial_ends_at,
      activeCoupons: recurlyCoupons,
      account: recurlySubscription.account,
    }
    if (recurlySubscription.pending_subscription) {
      const pendingPlan = PlansLocator.findLocalPlanInSettings(
        recurlySubscription.pending_subscription.plan.plan_code
      )
      if (pendingPlan == null) {
        throw new Error(
          `No plan found for planCode '${personalSubscription.planCode}'`
        )
      }
      let pendingAdditionalLicenses = 0
      let pendingAddOnTax = 0
      let pendingAddOnPrice = 0
      if (recurlySubscription.pending_subscription.subscription_add_ons) {
        if (
          pendingPlan.membersLimitAddOn &&
          Array.isArray(
            recurlySubscription.pending_subscription.subscription_add_ons
          )
        ) {
          recurlySubscription.pending_subscription.subscription_add_ons.forEach(
            addOn => {
              if (addOn.add_on_code === pendingPlan.membersLimitAddOn) {
                pendingAddOnPrice += addOn.quantity * addOn.unit_amount_in_cents
                pendingAdditionalLicenses += addOn.quantity
              }
            }
          )
        }
        // Need to calculate tax ourselves as we don't get tax amounts for pending subs
        pendingAddOnTax =
          personalSubscription.recurly.taxRate * pendingAddOnPrice
      }
      const pendingSubscriptionTax =
        personalSubscription.recurly.taxRate *
        recurlySubscription.pending_subscription.unit_amount_in_cents
      personalSubscription.recurly.displayPrice =
        SubscriptionFormatters.formatPrice(
          recurlySubscription.pending_subscription.unit_amount_in_cents +
            pendingAddOnPrice +
            pendingAddOnTax +
            pendingSubscriptionTax,
          recurlySubscription.currency
        )
      personalSubscription.recurly.currentPlanDisplayPrice =
        SubscriptionFormatters.formatPrice(
          recurlySubscription.unit_amount_in_cents + addOnPrice + tax,
          recurlySubscription.currency
        )
      const pendingTotalLicenses =
        (pendingPlan.membersLimit || 0) + pendingAdditionalLicenses
      personalSubscription.recurly.pendingAdditionalLicenses =
        pendingAdditionalLicenses
      personalSubscription.recurly.pendingTotalLicenses = pendingTotalLicenses
      personalSubscription.pendingPlan = pendingPlan
    } else {
      personalSubscription.recurly.displayPrice =
        SubscriptionFormatters.formatPrice(
          recurlySubscription.unit_amount_in_cents + addOnPrice + tax,
          recurlySubscription.currency
        )
    }
  }

  for (const memberGroupSubscription of memberGroupSubscriptions) {
    if (
      memberGroupSubscription.manager_ids?.some(
        id => id.toString() === user._id.toString()
      )
    ) {
      memberGroupSubscription.userIsGroupManager = true
    }
    if (memberGroupSubscription.teamNotice) {
      memberGroupSubscription.teamNotice = sanitizeHtml(
        memberGroupSubscription.teamNotice
      )
    }
    buildGroupSubscriptionForView(memberGroupSubscription)
  }

  for (const managedGroupSubscription of managedGroupSubscriptions) {
    if (
      managedGroupSubscription.member_ids?.some(
        id => id.toString() === user._id.toString()
      )
    ) {
      managedGroupSubscription.userIsGroupMember = true
    }
    buildGroupSubscriptionForView(managedGroupSubscription)
  }

  return {
    personalSubscription,
    managedGroupSubscriptions,
    memberGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
    v1SubscriptionStatus,
  }
}

/**
 * @param {{_id: string}} user
 * @returns {Promise<Subscription>}
 */
async function getBestSubscription(user) {
  let [
    individualSubscription,
    memberGroupSubscriptions,
    currentInstitutionsWithLicence,
  ] = await Promise.all([
    SubscriptionLocator.promises.getUsersSubscription(user),
    SubscriptionLocator.promises.getMemberSubscriptions(user),
    InstitutionsGetter.promises.getCurrentInstitutionsWithLicence(user._id),
  ])
  if (
    individualSubscription &&
    !individualSubscription.customAccount &&
    individualSubscription.recurlySubscription_id &&
    !individualSubscription.recurlyStatus?.state
  ) {
    const recurlySubscription = await RecurlyWrapper.promises.getSubscription(
      individualSubscription.recurlySubscription_id,
      { includeAccount: true }
    )
    await SubscriptionUpdater.promises.updateSubscriptionFromRecurly(
      recurlySubscription,
      individualSubscription
    )
    individualSubscription =
      await SubscriptionLocator.promises.getUsersSubscription(user)
  }
  let bestSubscription = {
    type: 'free',
  }
  if (currentInstitutionsWithLicence?.length) {
    for (const institutionMembership of currentInstitutionsWithLicence) {
      const plan = PlansLocator.findLocalPlanInSettings(
        Settings.institutionPlanCode
      )
      if (_isPlanEqualOrBetter(plan, bestSubscription.plan)) {
        bestSubscription = {
          type: 'commons',
          subscription: institutionMembership,
          plan,
        }
      }
    }
  }
  if (memberGroupSubscriptions?.length) {
    for (const groupSubscription of memberGroupSubscriptions) {
      const plan = PlansLocator.findLocalPlanInSettings(
        groupSubscription.planCode
      )
      if (_isPlanEqualOrBetter(plan, bestSubscription.plan)) {
        const remainingTrialDays = _getRemainingTrialDays(groupSubscription)
        bestSubscription = {
          type: 'group',
          subscription: groupSubscription,
          plan,
          remainingTrialDays,
        }
      }
    }
  }
  if (individualSubscription && !individualSubscription.groupPlan) {
    const plan = PlansLocator.findLocalPlanInSettings(
      individualSubscription.planCode
    )
    if (_isPlanEqualOrBetter(plan, bestSubscription.plan)) {
      const remainingTrialDays = _getRemainingTrialDays(individualSubscription)
      bestSubscription = {
        type: 'individual',
        subscription: individualSubscription,
        plan,
        remainingTrialDays,
      }
    }
  }
  return bestSubscription
}

function buildPlansList(currentPlan) {
  const { plans } = Settings

  const allPlans = {}
  plans.forEach(plan => {
    allPlans[plan.planCode] = plan
  })

  const result = { allPlans }

  if (currentPlan) {
    result.planCodesChangingAtTermEnd = _.pluck(
      _.filter(plans, plan => {
        if (!plan.hideFromUsers) {
          return SubscriptionHelper.shouldPlanChangeAtTermEnd(currentPlan, plan)
        }
      }),
      'planCode'
    )
  }

  result.studentAccounts = _.filter(
    plans,
    plan => plan.planCode.indexOf('student') !== -1
  )

  result.groupMonthlyPlans = _.filter(
    plans,
    plan => plan.groupPlan && !plan.annual
  )

  result.groupAnnualPlans = _.filter(
    plans,
    plan => plan.groupPlan && plan.annual
  )

  result.individualMonthlyPlans = _.filter(
    plans,
    plan =>
      !plan.groupPlan &&
      !plan.annual &&
      plan.planCode !== 'personal' && // Prevent the personal plan from appearing on the change-plans page
      plan.planCode.indexOf('student') === -1
  )

  result.individualAnnualPlans = _.filter(
    plans,
    plan =>
      !plan.groupPlan && plan.annual && plan.planCode.indexOf('student') === -1
  )

  return result
}

function _isPlanEqualOrBetter(planA, planB) {
  return FeaturesHelper.isFeatureSetBetter(
    planA?.features || {},
    planB?.features || {}
  )
}

function _getRemainingTrialDays(subscription) {
  const now = new Date()
  const trialEndDate = subscription.recurlyStatus?.trialEndsAt
  return trialEndDate && trialEndDate > now
    ? Math.ceil(
        (trialEndDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )
    : -1
}

function buildGroupSubscriptionForView(groupSubscription) {
  // most group plans in Recurly should be in form "group_plancode_size_usage"
  const planLevelFromGroupPlanCode = groupSubscription.planCode.substr(6, 12)
  if (planLevelFromGroupPlanCode === 'professional') {
    groupSubscription.planLevelName = 'Professional'
  } else if (planLevelFromGroupPlanCode === 'collaborator') {
    groupSubscription.planLevelName = 'Standard'
  }
  // there are some group subscription entries that have the personal plancodes...
  // this fallback tries to still show the right thing in these cases:
  if (!groupSubscription.planLevelName) {
    if (groupSubscription.planCode.startsWith('professional')) {
      groupSubscription.planLevelName = 'Professional'
    } else if (groupSubscription.planCode.startsWith('collaborator')) {
      groupSubscription.planLevelName = 'Standard'
    } else {
      // if we still don't have anything, we can show the plan name (eg, v1 Pro):
      const plan = PlansLocator.findLocalPlanInSettings(
        groupSubscription.planCode
      )
      groupSubscription.planLevelName = plan
        ? plan.name
        : groupSubscription.planCode
    }
  }
}

function buildPlansListForSubscriptionDash(currentPlan) {
  const allPlansData = buildPlansList(currentPlan)
  const plans = []
  // only list individual and visible plans for "change plans" UI
  if (allPlansData.studentAccounts) {
    plans.push(
      ...allPlansData.studentAccounts.filter(plan => !plan.hideFromUsers)
    )
  }
  if (allPlansData.individualMonthlyPlans) {
    plans.push(
      ...allPlansData.individualMonthlyPlans.filter(plan => !plan.hideFromUsers)
    )
  }
  if (allPlansData.individualAnnualPlans) {
    plans.push(
      ...allPlansData.individualAnnualPlans.filter(plan => !plan.hideFromUsers)
    )
  }

  return {
    plans,
    planCodesChangingAtTermEnd: allPlansData.planCodesChangingAtTermEnd,
  }
}

module.exports = {
  buildUsersSubscriptionViewModel: callbackify(buildUsersSubscriptionViewModel),
  buildPlansList,
  buildPlansListForSubscriptionDash,
  getBestSubscription: callbackify(getBestSubscription),
  promises: {
    buildUsersSubscriptionViewModel,
    getRedirectToHostedPage,
    getBestSubscription,
  },
}
