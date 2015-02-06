define [
	"base"
], (App)->
	SUBSCRIPTION_URL = "/user/subscription/update"
	recurly.configure window.recurlyApiKey

	App.controller "CurrenyDropdownController", ($scope, MultiCurrencyPricing, $q)->

		$scope.plans = MultiCurrencyPricing.plans
		$scope.currencyCode = MultiCurrencyPricing.currencyCode

		$scope.changeCurrency = (newCurrency)->
			MultiCurrencyPricing.currencyCode = newCurrency


	App.controller "ChangePlanFormController", ($scope, $modal, MultiCurrencyPricing)->

		
		taxRate = window.taxRate

		$scope.changePlan = ->
			$modal.open(
				templateUrl: "confirmChangePlanModalTemplate"
				controller:  "ConfirmChangePlanController"
				scope: $scope
			)

		$scope.$watch "pricing.currencyCode", ->
			$scope.currencyCode = MultiCurrencyPricing.currencyCode

		$scope.pricing = MultiCurrencyPricing
		$scope.plans = MultiCurrencyPricing.plans
		$scope.currencySymbol = MultiCurrencyPricing.plans[MultiCurrencyPricing.currencyCode].symbol

		$scope.currencyCode = MultiCurrencyPricing.currencyCode

		$scope.prices = {}
		$scope.refreshPrice = (planCode)->
			if $scope.prices[planCode]?
				return
			pricing = recurly.Pricing()
			pricing.plan(planCode, { quantity: 1 }).done (price)->
				totalPriceExTax = parseFloat(price.next.total)
				$scope.prices[planCode] = $scope.currencySymbol + (totalPriceExTax + (totalPriceExTax * taxRate))
			price = ""



	App.controller "ConfirmChangePlanController", ($scope, $modalInstance, $http)->
		$scope.confirmChangePlan = ->

			body = 
				plan_code: $scope.plan.planCode
				_csrf : window.csrfToken

			$scope.inflight = true


			$http.post(SUBSCRIPTION_URL, body)
				.success ->
					location.reload()
				.error ->
					console.log "something went wrong changing plan"

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')