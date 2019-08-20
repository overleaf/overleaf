/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Settings = require('settings-sharelatex')
const RecurlyWrapper = require('./RecurlyWrapper')
const PlansLocator = require('./PlansLocator')
const SubscriptionFormatters = require('./SubscriptionFormatters')
const LimitationsManager = require('./LimitationsManager')
const SubscriptionLocator = require('./SubscriptionLocator')
const V1SubscriptionManager = require('./V1SubscriptionManager')
const InstitutionsGetter = require('../Institutions/InstitutionsGetter')
const PublishersGetter = require('../Publishers/PublishersGetter')
const sanitizeHtml = require('sanitize-html')
const logger = require('logger-sharelatex')
const _ = require('underscore')
const async = require('async')

const buildHostedLink = function(recurlySubscription, type) {
  const recurlySubdomain = Settings.apis.recurly.subdomain
  const hostedLoginToken = recurlySubscription.account.hosted_login_token
  let path = ''
  if (type === 'billingDetails') {
    path = 'billing_info/edit?ht='
  }
  if (hostedLoginToken && recurlySubdomain) {
    return [
      'https://',
      recurlySubdomain,
      '.recurly.com/account/',
      path,
      hostedLoginToken
    ].join('')
  }
}

module.exports = {
  buildUsersSubscriptionViewModel(user, callback) {
    if (callback == null) {
      callback = function(error, data) {}
    }
    return async.auto(
      {
        personalSubscription(cb) {
          return SubscriptionLocator.getUsersSubscription(user, cb)
        },
        recurlySubscription: [
          'personalSubscription',
          function(cb, { personalSubscription }) {
            if (
              (personalSubscription != null
                ? personalSubscription.recurlySubscription_id
                : undefined) == null ||
              (personalSubscription != null
                ? personalSubscription.recurlySubscription_id
                : undefined) === ''
            ) {
              return cb(null, null)
            }
            return RecurlyWrapper.getSubscription(
              personalSubscription.recurlySubscription_id,
              { includeAccount: true },
              cb
            )
          }
        ],
        recurlyCoupons: [
          'recurlySubscription',
          function(cb, { recurlySubscription }) {
            if (!recurlySubscription) {
              return cb(null, null)
            }
            const accountId = recurlySubscription.account.account_code
            return RecurlyWrapper.getAccountActiveCoupons(accountId, cb)
          }
        ],
        plan: [
          'personalSubscription',
          function(cb, { personalSubscription }) {
            if (personalSubscription == null) {
              return cb()
            }
            const plan = PlansLocator.findLocalPlanInSettings(
              personalSubscription.planCode
            )
            if (plan == null) {
              return cb(
                new Error(
                  `No plan found for planCode '${
                    personalSubscription.planCode
                  }'`
                )
              )
            }
            return cb(null, plan)
          }
        ],
        memberGroupSubscriptions(cb) {
          return SubscriptionLocator.getMemberSubscriptions(user, cb)
        },
        managedGroupSubscriptions(cb) {
          return SubscriptionLocator.getManagedGroupSubscriptions(user, cb)
        },
        confirmedMemberInstitutions(cb) {
          return InstitutionsGetter.getConfirmedInstitutions(user._id, cb)
        },
        managedInstitutions(cb) {
          return InstitutionsGetter.getManagedInstitutions(user._id, cb)
        },
        managedPublishers(cb) {
          return PublishersGetter.getManagedPublishers(user._id, cb)
        },
        v1SubscriptionStatus(cb) {
          return V1SubscriptionManager.getSubscriptionStatusFromV1(
            user._id,
            function(error, status, v1Id) {
              if (error != null) {
                return cb(error)
              }
              return cb(null, status)
            }
          )
        }
      },
      function(err, results) {
        if (err != null) {
          return callback(err)
        }
        let {
          personalSubscription,
          memberGroupSubscriptions,
          managedGroupSubscriptions,
          confirmedMemberInstitutions,
          managedInstitutions,
          managedPublishers,
          v1SubscriptionStatus,
          recurlySubscription,
          recurlyCoupons,
          plan
        } = results
        if (memberGroupSubscriptions == null) {
          memberGroupSubscriptions = []
        }
        if (managedGroupSubscriptions == null) {
          managedGroupSubscriptions = []
        }
        if (confirmedMemberInstitutions == null) {
          confirmedMemberInstitutions = []
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

        if (
          (personalSubscription != null
            ? personalSubscription.toObject
            : undefined) != null
        ) {
          // Downgrade from Mongoose object, so we can add a recurly and plan attribute
          personalSubscription = personalSubscription.toObject()
        }

        if (plan != null) {
          personalSubscription.plan = plan
        }

        if (personalSubscription != null && recurlySubscription != null) {
          const tax =
            (recurlySubscription != null
              ? recurlySubscription.tax_in_cents
              : undefined) || 0
          personalSubscription.recurly = {
            tax,
            taxRate: parseFloat(
              __guard__(
                recurlySubscription != null
                  ? recurlySubscription.tax_rate
                  : undefined,
                x => x._
              )
            ),
            billingDetailsLink: buildHostedLink(
              recurlySubscription,
              'billingDetails'
            ),
            accountManagementLink: buildHostedLink(recurlySubscription),
            price: SubscriptionFormatters.formatPrice(
              (recurlySubscription != null
                ? recurlySubscription.unit_amount_in_cents
                : undefined) + tax,
              recurlySubscription != null
                ? recurlySubscription.currency
                : undefined
            ),
            nextPaymentDueAt: SubscriptionFormatters.formatDate(
              recurlySubscription != null
                ? recurlySubscription.current_period_ends_at
                : undefined
            ),
            currency: recurlySubscription.currency,
            state: recurlySubscription.state,
            trialEndsAtFormatted: SubscriptionFormatters.formatDate(
              recurlySubscription != null
                ? recurlySubscription.trial_ends_at
                : undefined
            ),
            trial_ends_at: recurlySubscription.trial_ends_at,
            activeCoupons: recurlyCoupons
          }
        }

        for (let memberGroupSubscription of Array.from(
          memberGroupSubscriptions
        )) {
          if (memberGroupSubscription.teamNotice) {
            memberGroupSubscription.teamNotice = sanitizeHtml(
              memberGroupSubscription.teamNotice
            )
          }
        }

        return callback(null, {
          personalSubscription,
          managedGroupSubscriptions,
          memberGroupSubscriptions,
          confirmedMemberInstitutions,
          managedInstitutions,
          managedPublishers,
          v1SubscriptionStatus
        })
      }
    )
  },

  buildViewModel() {
    const { plans } = Settings

    const allPlans = {}
    plans.forEach(plan => (allPlans[plan.planCode] = plan))

    const result = { allPlans }

    result.personalAccount = _.find(plans, plan => plan.planCode === 'personal')

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
        plan.planCode !== 'personal' &&
        plan.planCode.indexOf('student') === -1
    )

    result.individualAnnualPlans = _.filter(
      plans,
      plan =>
        !plan.groupPlan &&
        plan.annual &&
        plan.planCode.indexOf('student') === -1
    )

    return result
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
