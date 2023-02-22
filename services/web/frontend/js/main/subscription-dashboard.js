import _ from 'lodash'
/* global recurly */

/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import App from '../base'
import getMeta from '../utils/meta'
const SUBSCRIPTION_URL = '/user/subscription/update'

const GROUP_PLAN_MODAL_OPTIONS = getMeta('ol-groupPlanModalOptions')

const ensureRecurlyIsSetup = _.once(() => {
  if (typeof recurly === 'undefined' || !recurly) {
    return false
  }
  recurly.configure(getMeta('ol-recurlyApiKey'))
  return true
})

function getPricePerUser(price, currencySymbol, size) {
  let perUserPrice = price / size
  if (perUserPrice % 1 !== 0) {
    perUserPrice = perUserPrice.toFixed(2)
  }
  return `${currencySymbol}${perUserPrice}`
}

App.controller('MetricsEmailController', function ($scope, $http) {
  $scope.institutionEmailSubscription = function (institutionId) {
    const inst = _.find(window.managedInstitutions, function (institution) {
      return institution.v1Id === parseInt(institutionId)
    })
    if (inst.metricsEmail.optedOutUserIds.includes(window.user_id)) {
      return 'Subscribe'
    } else {
      return 'Unsubscribe'
    }
  }

  $scope.changeInstitutionalEmailSubscription = function (institutionId) {
    $scope.subscriptionChanging = true
    return $http({
      method: 'POST',
      url: `/institutions/${institutionId}/emailSubscription`,
      headers: {
        'X-CSRF-Token': window.csrfToken,
      },
    }).then(function successCallback(response) {
      window.managedInstitutions = _.map(
        window.managedInstitutions,
        function (institution) {
          if (institution.v1Id === parseInt(institutionId)) {
            institution.metricsEmail.optedOutUserIds = response.data
          }
          return institution
        }
      )
      $scope.subscriptionChanging = false
    })
  }
})

App.factory('RecurlyPricing', function ($q, MultiCurrencyPricing) {
  return {
    loadDisplayPriceWithTax: function (planCode, currency, taxRate) {
      if (!ensureRecurlyIsSetup()) return
      const currencySymbol = MultiCurrencyPricing.plans[currency].symbol
      const pricing = recurly.Pricing()
      return $q(function (resolve, reject) {
        pricing
          .plan(planCode, { quantity: 1 })
          .currency(currency)
          .done(function (price) {
            const totalPriceExTax = parseFloat(price.next.total)
            let taxAmount = totalPriceExTax * taxRate
            if (isNaN(taxAmount)) {
              taxAmount = 0
            }
            let total = totalPriceExTax + taxAmount
            if (total % 1 !== 0) {
              total = total.toFixed(2)
            }
            resolve({
              total: `${currencySymbol}${total}`,
              totalValue: total,
              subtotal: `${currencySymbol}${totalPriceExTax.toFixed(2)}`,
              tax: `${currencySymbol}${taxAmount.toFixed(2)}`,
              includesTax: taxAmount !== 0,
            })
          })
      })
    },
  }
})

App.controller('ChangePlanToGroupFormController', function ($scope, $modal) {
  if (!ensureRecurlyIsSetup()) return

  const subscription = getMeta('ol-subscription')
  const currency = subscription.recurly.currency

  const validCurrencies = GROUP_PLAN_MODAL_OPTIONS.currencies.map(
    item => item.code
  )

  if (validCurrencies.includes(currency)) {
    $scope.isValidCurrencyForUpgrade = true
  }

  $scope.openGroupPlanModal = function () {
    const planCode = subscription.plan.planCode
    $scope.defaultGroupPlan = planCode.includes('professional')
      ? 'professional'
      : 'collaborator'
    $scope.currentPlanCurrency = currency
    $modal.open({
      templateUrl: 'groupPlanModalUpgradeTemplate',
      controller: 'GroupPlansModalUpgradeController',
      scope: $scope,
    })
  }
})

App.controller(
  'GroupPlansModalUpgradeController',
  function ($scope, $modal, $location, $http, RecurlyPricing) {
    $scope.options = GROUP_PLAN_MODAL_OPTIONS

    $scope.groupPlans = getMeta('ol-groupPlans')

    const currency = $scope.currentPlanCurrency

    // default selected
    $scope.selected = {
      plan_code: $scope.defaultGroupPlan || 'collaborator',
      currency,
      size: '10',
      usage: 'enterprise',
    }

    $scope.recalculatePrice = function () {
      const subscription = getMeta('ol-subscription')
      const { taxRate } = subscription.recurly
      const { usage, plan_code, currency, size } = $scope.selected
      $scope.discountEligible = size >= 10
      const recurlyPricePlaceholder = { total: '...' }
      let perUserDisplayPricePlaceholder = '...'
      const currencySymbol = $scope.options.currencySymbols[currency]
      if (taxRate === 0) {
        const basePriceInCents =
          $scope.groupPlans[usage][plan_code][currency][size].price_in_cents
        const basePriceInUnit = (basePriceInCents / 100).toFixed()
        recurlyPricePlaceholder.total = `${currencySymbol}${basePriceInUnit}`
        perUserDisplayPricePlaceholder = getPricePerUser(
          basePriceInUnit,
          currencySymbol,
          size
        )
      }
      $scope.recurlyPrice = recurlyPricePlaceholder // Placeholder while we talk to recurly
      $scope.perUserDisplayPrice = perUserDisplayPricePlaceholder // Placeholder while we talk to recurly
      const recurlyPlanCode = `group_${plan_code}_${size}_${usage}`
      RecurlyPricing.loadDisplayPriceWithTax(
        recurlyPlanCode,
        currency,
        taxRate
      ).then(price => {
        $scope.recurlyPrice = price
        $scope.perUserDisplayPrice = getPricePerUser(
          price.totalValue,
          currencySymbol,
          size
        )
      })
    }

    $scope.$watch('selected', $scope.recalculatePrice, true)
    $scope.recalculatePrice()

    $scope.upgrade = function () {
      const { plan_code, size, usage } = $scope.selected
      const body = {
        _csrf: window.csrfToken,
        plan_code: `group_${plan_code}_${size}_${usage}`,
      }
      $scope.inflight = true
      $http
        .post(`/user/subscription/update`, body)
        .then(() => location.reload())
    }
  }
)

App.controller(
  'ChangePlanFormController',
  function ($scope, $modal, RecurlyPricing) {
    if (!ensureRecurlyIsSetup()) return

    function stripCentsIfZero(displayPrice) {
      return displayPrice ? displayPrice.replace(/\.00$/, '') : '...'
    }

    $scope.changePlan = () =>
      $modal.open({
        templateUrl: 'confirmChangePlanModalTemplate',
        controller: 'ConfirmChangePlanController',
        scope: $scope,
      })

    $scope.cancelPendingPlanChange = () =>
      $modal.open({
        templateUrl: 'cancelPendingPlanChangeModalTemplate',
        controller: 'CancelPendingPlanChangeController',
        scope: $scope,
      })

    $scope.$watch('plan', function (plan) {
      if (!plan) return
      const planCodesChangingAtTermEnd = getMeta(
        'ol-planCodesChangingAtTermEnd'
      )
      $scope.planChangesAtTermEnd = false
      if (
        planCodesChangingAtTermEnd &&
        planCodesChangingAtTermEnd.indexOf(plan.planCode) > -1
      ) {
        $scope.planChangesAtTermEnd = true
      }
      const planCode = plan.planCode
      const subscription = getMeta('ol-subscription')
      const { currency, taxRate } = subscription.recurly
      if (subscription.recurly.displayPrice) {
        if (subscription.pendingPlan?.planCode === planCode) {
          $scope.displayPrice = stripCentsIfZero(
            subscription.recurly.displayPrice
          )
          return
        }
        if (subscription.planCode === planCode) {
          if (subscription.pendingPlan) {
            $scope.displayPrice = stripCentsIfZero(
              subscription.recurly.currentPlanDisplayPrice
            )
          } else {
            $scope.displayPrice = stripCentsIfZero(
              subscription.recurly.displayPrice
            )
          }
          return
        }
      }
      $scope.displayPrice = '...' // Placeholder while we talk to recurly
      RecurlyPricing.loadDisplayPriceWithTax(planCode, currency, taxRate).then(
        recurlyPrice => {
          $scope.displayPrice = recurlyPrice.total
        }
      )
    })
  }
)

App.controller(
  'ConfirmChangePlanController',
  function ($scope, $modalInstance, $http) {
    $scope.confirmChangePlan = function () {
      const body = {
        plan_code: $scope.plan.planCode,
        _csrf: window.csrfToken,
      }

      $scope.genericError = false
      $scope.inflight = true

      return $http
        .post(`${SUBSCRIPTION_URL}?origin=confirmChangePlan`, body)
        .then(() => location.reload())
        .catch(() => {
          $scope.genericError = true
          $scope.inflight = false
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }
)

App.controller(
  'CancelPendingPlanChangeController',
  function ($scope, $modalInstance, $http) {
    $scope.confirmCancelPendingPlanChange = function () {
      const body = {
        _csrf: window.csrfToken,
      }

      $scope.genericError = false
      $scope.inflight = true

      return $http
        .post('/user/subscription/cancel-pending', body)
        .then(() => location.reload())
        .catch(() => {
          $scope.genericError = true
          $scope.inflight = false
        })
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }
)

App.controller(
  'LeaveGroupModalController',
  function ($scope, $modalInstance, $http) {
    $scope.confirmLeaveGroup = function () {
      $scope.inflight = true
      return $http({
        url: '/subscription/group/user',
        method: 'DELETE',
        params: {
          subscriptionId: $scope.subscriptionId,
          _csrf: window.csrfToken,
        },
      })
        .then(() => window.location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  }
)

App.controller('GroupMembershipController', function ($scope, $modal) {
  $scope.removeSelfFromGroup = function (subscriptionId) {
    $scope.subscriptionId = subscriptionId
    return $modal.open({
      templateUrl: 'LeaveGroupModalTemplate',
      controller: 'LeaveGroupModalController',
      scope: $scope,
    })
  }
})

App.controller('RecurlySubscriptionController', function ($scope) {
  const recurlyIsSetup = ensureRecurlyIsSetup()
  const subscription = getMeta('ol-subscription')
  $scope.showChangePlanButton = recurlyIsSetup && !subscription.groupPlan
  if (
    window.subscription.recurly.account.has_past_due_invoice &&
    window.subscription.recurly.account.has_past_due_invoice._ === 'true'
  ) {
    $scope.showChangePlanButton = false
  }
  $scope.recurlyLoadError = !recurlyIsSetup

  $scope.switchToDefaultView = () => {
    $scope.showCancellation = false
    $scope.showChangePlan = false
  }
  $scope.switchToDefaultView()

  $scope.switchToCancellationView = () => {
    $scope.showCancellation = true
    $scope.showChangePlan = false
  }

  $scope.switchToChangePlanView = () => {
    $scope.showCancellation = false
    $scope.showChangePlan = true
  }
})

App.controller(
  'RecurlyCancellationController',
  function ($scope, RecurlyPricing, $http) {
    if (!ensureRecurlyIsSetup()) return
    const subscription = getMeta('ol-subscription')
    const sevenDaysTime = new Date()
    sevenDaysTime.setDate(sevenDaysTime.getDate() + 7)
    const freeTrialEndDate = new Date(subscription.recurly.trial_ends_at)
    const freeTrialInFuture = freeTrialEndDate > new Date()
    const freeTrialExpiresUnderSevenDays = freeTrialEndDate < sevenDaysTime

    const isMonthlyCollab =
      subscription.plan.planCode.indexOf('collaborator') !== -1 &&
      subscription.plan.planCode.indexOf('ann') === -1 &&
      !subscription.groupPlan
    const stillInFreeTrial = freeTrialInFuture && freeTrialExpiresUnderSevenDays

    if (isMonthlyCollab && stillInFreeTrial) {
      $scope.showExtendFreeTrial = true
    } else if (isMonthlyCollab && !stillInFreeTrial) {
      $scope.showDowngrade = true
    } else {
      $scope.showBasicCancel = true
    }

    const planCode = 'paid-personal'
    const { currency, taxRate } = subscription.recurly
    $scope.personalDisplayPrice = '...' // Placeholder while we talk to recurly
    RecurlyPricing.loadDisplayPriceWithTax(planCode, currency, taxRate).then(
      price => {
        $scope.personalDisplayPrice = price.total
      }
    )

    $scope.downgradeToPaidPersonal = function () {
      const body = {
        plan_code: planCode,
        _csrf: window.csrfToken,
      }
      $scope.inflight = true
      return $http
        .post(`${SUBSCRIPTION_URL}?origin=downgradeToPaidPersonal`, body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    $scope.cancelSubscription = function () {
      const body = { _csrf: window.csrfToken }

      $scope.inflight = true
      return $http
        .post('/user/subscription/cancel', body)
        .then(() => (location.href = '/user/subscription/canceled'))
        .catch(() => console.log('something went wrong changing plan'))
    }

    $scope.extendTrial = function () {
      const body = { _csrf: window.csrfToken }
      $scope.inflight = true
      return $http
        .put('/user/subscription/extend', body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }
  }
)
