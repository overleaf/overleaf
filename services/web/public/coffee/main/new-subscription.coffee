define [
	"base"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager)->
	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans


		if MultiCurrencyPricing.currencyCode != "USD"
			currencyBuckets = [
				{ bucketName:"eu-eu", currency:MultiCurrencyPricing.currencyCode}
				{ bucketName:"eu-usd", currency:"USD"}
			]
			multiCurrencyBucket = abTestManager.getABTestBucket "multi_currency", currencyBuckets
			$scope.currencyCode = multiCurrencyBucket.currency
			abTestManager.processTestWithStep("multi_currency_editor", multiCurrencyBucket.bucketName, 0)


		$scope.changeCurrency = (newCurrency)->
			window.location = "/user/subscription/new?planCode=#{window.plan_code}&currency=#{newCurrency}"