define [
	"base"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager)->
	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans

		$scope.changeCurrency = (newCurrency)->
			window.location = "/user/subscription/new?planCode=#{window.plan_code}&currency=#{newCurrency}"

		$scope.switchToStudent = ()->
			window.location = "/user/subscription/new?planCode=student&currency=#{$scope.currencyCode}"





		__api_key = recurlyCreds.apiKey
		__api_url = recurlyCreds.apiUrl
		configured = false
		$scope.error = false
		$scope.token = false
		$scope.data =
			number: ""
			month: ""
			year: ""
			cvv: ""
			first_name: ""
			last_last: ""
			postal_code: ""

		$scope.submit = ->
			throw new Error("Recurly API Library Missing.")  if typeof recurly is "undefined"
			console.log $scope.data
			$scope.error = ""
			if !configured
				recurly.configure __api_key
				configured = true
			recurly.token $scope.data, (err, token) ->
				if err
					$scope.error = err.message
				else
					$scope.token = token

