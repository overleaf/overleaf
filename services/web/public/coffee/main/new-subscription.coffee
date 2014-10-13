define [
	"base"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing)->

	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans

		$scope.changeCurrency = (newCurrency)->
			window.location = "/user/subscription/new?planCode=#{window.plan_code}&currency=#{newCurrency}"