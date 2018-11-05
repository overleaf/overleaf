/* eslint-disable
    camelcase,
    max-len,
    no-return-assign,
    no-undef,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS104: Avoid inline assignments
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
define(['base'], function(App) {
  App.controller('SuccessfulSubscriptionController', function(
    $scope,
    sixpack
  ) {})

  const SUBSCRIPTION_URL = '/user/subscription/update'

  const setupReturly = _.once(
    () =>
      typeof recurly !== 'undefined' && recurly !== null
        ? recurly.configure(window.recurlyApiKey)
        : undefined
  )
  const PRICES = {}

  App.controller('CurrenyDropdownController', function(
    $scope,
    MultiCurrencyPricing,
    $q
  ) {
    // $scope.plans = MultiCurrencyPricing.plans
    $scope.currencyCode = MultiCurrencyPricing.currencyCode

    return ($scope.changeCurrency = newCurrency =>
      (MultiCurrencyPricing.currencyCode = newCurrency))
  })

  App.controller('ChangePlanFormController', function(
    $scope,
    $modal,
    MultiCurrencyPricing
  ) {
    setupReturly()
    const { taxRate } = window

    $scope.changePlan = () =>
      $modal.open({
        templateUrl: 'confirmChangePlanModalTemplate',
        controller: 'ConfirmChangePlanController',
        scope: $scope
      })

    $scope.$watch(
      'pricing.currencyCode',
      () => ($scope.currencyCode = MultiCurrencyPricing.currencyCode)
    )

    $scope.pricing = MultiCurrencyPricing
    // $scope.plans = MultiCurrencyPricing.plans
    $scope.currencySymbol =
      MultiCurrencyPricing.plans[MultiCurrencyPricing.currencyCode] != null
        ? MultiCurrencyPricing.plans[MultiCurrencyPricing.currencyCode].symbol
        : undefined

    $scope.currencyCode = MultiCurrencyPricing.currencyCode

    $scope.prices = PRICES
    return ($scope.refreshPrice = function(planCode) {
      let price
      if ($scope.prices[planCode] != null) {
        return
      }
      $scope.prices[planCode] = '...'
      const pricing = recurly.Pricing()
      pricing
        .plan(planCode, { quantity: 1 })
        .currency(MultiCurrencyPricing.currencyCode)
        .done(function(price) {
          const totalPriceExTax = parseFloat(price.next.total)
          return $scope.$evalAsync(function() {
            let taxAmmount = totalPriceExTax * taxRate
            if (isNaN(taxAmmount)) {
              taxAmmount = 0
            }
            return ($scope.prices[planCode] =
              $scope.currencySymbol + (totalPriceExTax + taxAmmount))
          })
        })

      return (price = '')
    })
  })

  App.controller('ConfirmChangePlanController', function(
    $scope,
    $modalInstance,
    $http
  ) {
    $scope.confirmChangePlan = function() {
      const body = {
        plan_code: $scope.plan.planCode,
        _csrf: window.csrfToken
      }

      $scope.inflight = true

      return $http
        .post(`${SUBSCRIPTION_URL}?origin=confirmChangePlan`, body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })

  App.controller('LeaveGroupModalController', function(
    $scope,
    $modalInstance,
    $http
  ) {
    $scope.confirmLeaveGroup = function() {
      $scope.inflight = true
      return $http({
        url: '/subscription/group/user',
        method: 'DELETE',
        params: { admin_user_id: $scope.admin_id, _csrf: window.csrfToken }
      })
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    return ($scope.cancel = () => $modalInstance.dismiss('cancel'))
  })

  return App.controller('UserSubscriptionController', function(
    $scope,
    MultiCurrencyPricing,
    $http,
    sixpack,
    $modal
  ) {
    $scope.plans = MultiCurrencyPricing.plans

    const freeTrialEndDate = new Date(
      typeof subscription !== 'undefined' && subscription !== null
        ? subscription.trial_ends_at
        : undefined
    )

    const sevenDaysTime = new Date()
    sevenDaysTime.setDate(sevenDaysTime.getDate() + 7)

    const freeTrialInFuture = freeTrialEndDate > new Date()
    const freeTrialExpiresUnderSevenDays = freeTrialEndDate < sevenDaysTime

    $scope.view = 'overview'
    $scope.getSuffix = planCode =>
      __guard__(
        planCode != null ? planCode.match(/(.*?)_(.*)/) : undefined,
        x => x[2]
      ) || null
    $scope.subscriptionSuffix = $scope.getSuffix(
      __guard__(
        typeof window !== 'undefined' && window !== null
          ? window.subscription
          : undefined,
        x => x.planCode
      )
    )
    if ($scope.subscriptionSuffix === 'free_trial_7_days') {
      $scope.subscriptionSuffix = ''
    }
    $scope.isNextGenPlan = ['heron', 'ibis'].includes($scope.subscriptionSuffix)

    $scope.shouldShowPlan = function(planCode) {
      let needle
      return (
        (needle = $scope.getSuffix(planCode)),
        !['heron', 'ibis'].includes(needle)
      )
    }

    const isMonthlyCollab =
      __guard__(
        typeof subscription !== 'undefined' && subscription !== null
          ? subscription.planCode
          : undefined,
        x1 => x1.indexOf('collaborator')
      ) !== -1 &&
      __guard__(
        typeof subscription !== 'undefined' && subscription !== null
          ? subscription.planCode
          : undefined,
        x2 => x2.indexOf('ann')
      ) === -1
    const stillInFreeTrial = freeTrialInFuture && freeTrialExpiresUnderSevenDays

    if (isMonthlyCollab && stillInFreeTrial) {
      $scope.showExtendFreeTrial = true
    } else if (isMonthlyCollab && !stillInFreeTrial) {
      $scope.showDowngradeToStudent = true
    } else {
      $scope.showBasicCancel = true
    }

    setupReturly()

    recurly
      .Pricing()
      .plan('student', { quantity: 1 })
      .currency(MultiCurrencyPricing.currencyCode)
      .done(function(price) {
        const totalPriceExTax = parseFloat(price.next.total)
        return $scope.$evalAsync(function() {
          let taxAmmount = totalPriceExTax * taxRate
          if (isNaN(taxAmmount)) {
            taxAmmount = 0
          }
          $scope.currencySymbol =
            MultiCurrencyPricing.plans[MultiCurrencyPricing.currencyCode].symbol
          return ($scope.studentPrice =
            $scope.currencySymbol + (totalPriceExTax + taxAmmount))
        })
      })

    $scope.downgradeToStudent = function() {
      const body = {
        plan_code: 'student',
        _csrf: window.csrfToken
      }
      $scope.inflight = true
      return $http
        .post(`${SUBSCRIPTION_URL}?origin=downgradeToStudent`, body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    $scope.cancelSubscription = function() {
      const body = { _csrf: window.csrfToken }

      $scope.inflight = true
      return $http
        .post('/user/subscription/cancel', body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    }

    $scope.removeSelfFromGroup = function(admin_id) {
      $scope.admin_id = admin_id
      return $modal.open({
        templateUrl: 'LeaveGroupModalTemplate',
        controller: 'LeaveGroupModalController',
        scope: $scope
      })
    }

    $scope.switchToCancelationView = () => ($scope.view = 'cancelation')

    return ($scope.exendTrial = function() {
      const body = { _csrf: window.csrfToken }
      $scope.inflight = true
      return $http
        .put('/user/subscription/extend', body)
        .then(() => location.reload())
        .catch(() => console.log('something went wrong changing plan'))
    })
  })
})

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
