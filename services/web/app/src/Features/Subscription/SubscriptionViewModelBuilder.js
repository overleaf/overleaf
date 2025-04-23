// ts-check
const Settings = require('@overleaf/settings')
const RecurlyWrapper = require('./RecurlyWrapper')
const PlansLocator = require('./PlansLocator')
const {
  isStandaloneAiAddOnPlanCode,
  MEMBERS_LIMIT_ADD_ON_CODE,
} = require('./PaymentProviderEntities')
const SubscriptionFormatters = require('./SubscriptionFormatters')
const SubscriptionLocator = require('./SubscriptionLocator')
const SubscriptionUpdater = require('./SubscriptionUpdater')
const InstitutionsGetter = require('../Institutions/InstitutionsGetter')
const InstitutionsManager = require('../Institutions/InstitutionsManager')
const PublishersGetter = require('../Publishers/PublishersGetter')
const sanitizeHtml = require('sanitize-html')
const _ = require('lodash')
const async = require('async')
const SubscriptionHelper = require('./SubscriptionHelper')
const { callbackify } = require('@overleaf/promise-utils')
const { V1ConnectionError } = require('../Errors/Errors')
const FeaturesHelper = require('./FeaturesHelper')
const { formatCurrency } = require('../../util/currency')
const Modules = require('../../infrastructure/Modules')

/**
 * @import { Subscription } from "../../../../types/project/dashboard/subscription"
 */

function buildHostedLink(type) {
  return `/user/subscription/payment/${type}`
}

// Downgrade from Mongoose object, so we can add custom attributes to object
function serializeMongooseObject(object) {
  return object && typeof object.toObject === 'function'
    ? object.toObject()
    : object
}

async function buildUsersSubscriptionViewModel(user, locale = 'en') {
  let {
    personalSubscription,
    memberGroupSubscriptions,
    managedGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
    fetchedPaymentRecord,
    plan,
  } = await async.auto({
    personalSubscription(cb) {
      SubscriptionLocator.getUsersSubscription(user, cb)
    },
    fetchedPaymentRecord: [
      'personalSubscription',
      ({ personalSubscription }, cb) => {
        Modules.hooks.fire('getPaymentFromRecord', personalSubscription, cb)
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
  })

  const paymentRecord = fetchedPaymentRecord && fetchedPaymentRecord[0]

  if (memberGroupSubscriptions == null) {
    memberGroupSubscriptions = []
  } else {
    memberGroupSubscriptions = memberGroupSubscriptions.map(group => {
      const userIsGroupManager = group.manager_ids?.some(
        id => id.toString() === user._id.toString()
      )

      const groupDataForView = {
        _id: group._id,
        planCode: group.planCode,
        teamName: group.teamName,
        admin_id: {
          email: group.admin_id.email,
        },
        userIsGroupManager,
      }

      if (group.teamNotice) {
        groupDataForView.teamNotice = sanitizeHtml(group.teamNotice)
      }

      buildGroupSubscriptionForView(groupDataForView)

      return groupDataForView
    })
  }

  if (managedGroupSubscriptions == null) {
    managedGroupSubscriptions = []
  } else {
    managedGroupSubscriptions = managedGroupSubscriptions.map(group => {
      const userIsGroupMember = group.member_ids?.some(
        id => id.toString() === user._id.toString()
      )

      const groupDataForView = {
        _id: group._id,
        planCode: group.planCode,
        groupPlan: group.groupPlan,
        teamName: group.teamName,
        admin_id: {
          _id: group.admin_id._id,
          email: group.admin_id.email,
        },
        features: group.features,
        userIsGroupMember,
      }

      buildGroupSubscriptionForView(groupDataForView)

      return groupDataForView
    })
  }

  if (managedInstitutions == null) {
    managedInstitutions = []
  }

  personalSubscription = serializeMongooseObject(personalSubscription)

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

  function getPlanOnlyDisplayPrice(
    totalPlanPriceInCents,
    taxRate,
    addOns = []
  ) {
    // The MEMBERS_LIMIT_ADD_ON_CODE is considered as part of the new plan model
    const allAddOnsPriceInCentsExceptAdditionalLicensePrice = addOns.reduce(
      (prev, curr) => {
        return curr.code !== MEMBERS_LIMIT_ADD_ON_CODE
          ? curr.quantity * curr.unitPrice + prev
          : prev
      },
      0
    )
    const allAddOnsTotalPriceInCentsExceptAdditionalLicensePrice =
      allAddOnsPriceInCentsExceptAdditionalLicensePrice +
      allAddOnsPriceInCentsExceptAdditionalLicensePrice * taxRate

    return formatCurrency(
      totalPlanPriceInCents -
        allAddOnsTotalPriceInCentsExceptAdditionalLicensePrice,
      paymentRecord.subscription.currency,
      locale
    )
  }

  function getAddOnDisplayPricesWithoutAdditionalLicense(taxRate, addOns = []) {
    return addOns.reduce((prev, curr) => {
      if (curr.code !== MEMBERS_LIMIT_ADD_ON_CODE) {
        const priceInCents = curr.quantity * curr.unitPrice
        const totalPriceInCents = priceInCents + priceInCents * taxRate

        if (totalPriceInCents > 0) {
          prev[curr.code] = formatCurrency(
            totalPriceInCents,
            paymentRecord.subscription.currency,
            locale
          )
        }
      }

      return prev
    }, {})
  }

  if (personalSubscription && paymentRecord && paymentRecord.subscription) {
    // don't return subscription payment information
    delete personalSubscription.paymentProvider
    delete personalSubscription.recurly

    const tax = paymentRecord.subscription.taxAmount || 0
    // Some plans allow adding more seats than the base plan provides.
    // This is recorded as a subscription add on.
    // Note: taxAmount already includes the tax for any addon.
    let addOnPrice = 0
    let additionalLicenses = 0
    const addOns = paymentRecord.subscription.addOns || []
    const taxRate = paymentRecord.subscription.taxRate
    addOns.forEach(addOn => {
      addOnPrice += addOn.quantity * addOn.unitPrice
      if (addOn.code === plan.membersLimitAddOn) {
        additionalLicenses += addOn.quantity
      }
    })
    const totalLicenses = (plan.membersLimit || 0) + additionalLicenses
    personalSubscription.payment = {
      taxRate,
      billingDetailsLink:
        paymentRecord.subscription.service === 'recurly'
          ? buildHostedLink('billing-details')
          : null,
      accountManagementLink: buildHostedLink('account-management'),
      additionalLicenses,
      addOns,
      totalLicenses,
      nextPaymentDueAt: SubscriptionFormatters.formatDateTime(
        paymentRecord.subscription.periodEnd
      ),
      nextPaymentDueDate: SubscriptionFormatters.formatDate(
        paymentRecord.subscription.periodEnd
      ),
      currency: paymentRecord.subscription.currency,
      state: paymentRecord.subscription.state,
      trialEndsAtFormatted: SubscriptionFormatters.formatDateTime(
        paymentRecord.subscription.trialPeriodEnd
      ),
      trialEndsAt: paymentRecord.subscription.trialPeriodEnd,
      activeCoupons: paymentRecord.coupons,
      accountEmail: paymentRecord.account.email,
      hasPastDueInvoice: paymentRecord.account.hasPastDueInvoice,
      pausedAt: paymentRecord.subscription.pausePeriodStart,
      remainingPauseCycles: paymentRecord.subscription.remainingPauseCycles,
    }
    if (paymentRecord.subscription.pendingChange) {
      const pendingPlanCode =
        paymentRecord.subscription.pendingChange.nextPlanCode
      const pendingPlan = PlansLocator.findLocalPlanInSettings(pendingPlanCode)
      if (pendingPlan == null) {
        throw new Error(`No plan found for planCode '${pendingPlanCode}'`)
      }
      let pendingAdditionalLicenses = 0
      let pendingAddOnTax = 0
      let pendingAddOnPrice = 0
      if (paymentRecord.subscription.pendingChange.nextAddOns) {
        const pendingAddOns =
          paymentRecord.subscription.pendingChange.nextAddOns
        pendingAddOns.forEach(addOn => {
          pendingAddOnPrice += addOn.quantity * addOn.unitPrice
          if (addOn.code === pendingPlan.membersLimitAddOn) {
            pendingAdditionalLicenses += addOn.quantity
          }
        })
        // Need to calculate tax ourselves as we don't get tax amounts for pending subs
        pendingAddOnTax =
          personalSubscription.payment.taxRate * pendingAddOnPrice
        pendingPlan.addOns = pendingAddOns
      }
      const pendingSubscriptionTax =
        personalSubscription.payment.taxRate *
        paymentRecord.subscription.pendingChange.nextPlanPrice
      const totalPrice =
        paymentRecord.subscription.pendingChange.nextPlanPrice +
        pendingAddOnPrice +
        pendingAddOnTax +
        pendingSubscriptionTax

      personalSubscription.payment.displayPrice = formatCurrency(
        totalPrice,
        paymentRecord.subscription.currency,
        locale
      )
      personalSubscription.payment.planOnlyDisplayPrice =
        getPlanOnlyDisplayPrice(
          totalPrice,
          taxRate,
          paymentRecord.subscription.pendingChange.nextAddOns
        )
      personalSubscription.payment.addOnDisplayPricesWithoutAdditionalLicense =
        getAddOnDisplayPricesWithoutAdditionalLicense(
          taxRate,
          paymentRecord.subscription.pendingChange.nextAddOns
        )
      const pendingTotalLicenses =
        (pendingPlan.membersLimit || 0) + pendingAdditionalLicenses
      personalSubscription.payment.pendingAdditionalLicenses =
        pendingAdditionalLicenses
      personalSubscription.payment.pendingTotalLicenses = pendingTotalLicenses
      personalSubscription.pendingPlan = pendingPlan
    } else {
      const totalPrice = paymentRecord.subscription.planPrice + addOnPrice + tax
      personalSubscription.payment.displayPrice = formatCurrency(
        totalPrice,
        paymentRecord.subscription.currency,
        locale
      )
      personalSubscription.payment.planOnlyDisplayPrice =
        getPlanOnlyDisplayPrice(totalPrice, taxRate, addOns)
      personalSubscription.payment.addOnDisplayPricesWithoutAdditionalLicense =
        getAddOnDisplayPricesWithoutAdditionalLicense(taxRate, addOns)
    }
  }

  return {
    personalSubscription,
    managedGroupSubscriptions,
    memberGroupSubscriptions,
    currentInstitutionsWithLicence,
    managedInstitutions,
    managedPublishers,
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
        const groupDataForView = {}
        if (groupSubscription.teamName) {
          groupDataForView.teamName = groupSubscription.teamName
        }
        const remainingTrialDays = _getRemainingTrialDays(groupSubscription)
        bestSubscription = {
          type: 'group',
          subscription: groupDataForView,
          plan,
          remainingTrialDays,
        }
      }
    }
  }
  if (individualSubscription && !individualSubscription.groupPlan) {
    if (
      isStandaloneAiAddOnPlanCode(individualSubscription.planCode) &&
      bestSubscription.type === 'free'
    ) {
      bestSubscription = { type: 'standalone-ai-add-on' }
    } else {
      const plan = PlansLocator.findLocalPlanInSettings(
        individualSubscription.planCode
      )
      if (_isPlanEqualOrBetter(plan, bestSubscription.plan)) {
        const remainingTrialDays = _getRemainingTrialDays(
          individualSubscription
        )
        bestSubscription = {
          type: 'individual',
          subscription: individualSubscription,
          plan,
          remainingTrialDays,
        }
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
    result.planCodesChangingAtTermEnd = _.map(
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
    getBestSubscription,
  },
}
