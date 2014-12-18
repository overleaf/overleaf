define [
	"base"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager, $http)->
	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans

		$scope.changeCurrency = (newCurrency)->
			window.location = "/user/subscription/new?planCode=#{window.plan_code}&currency=#{newCurrency}"

		$scope.switchToStudent = ()->
			window.location = "/user/subscription/new?planCode=student&currency=#{$scope.currencyCode}"

		__api_key = recurlyCreds.apiKey
		configured = false
		$scope.error = false
		$scope.token = false
		$scope.data =
			number: "4111111111111111"
			month: "02"
			year: "2015"
			cvv: "111"
			first_name: "h"
			last_name: "o"
			postal_code: "se153tt"
			address1 : "7 somewhere"
			city:"london"
			country:"uk"



		$scope.submit = ->
			throw new Error("Recurly API Library Missing.")  if typeof recurly is "undefined"
			console.log $scope.data
			$scope.error = ""
			if !configured
				recurly.configure __api_key
				configured = true
			recurly.token $scope.data, (err, recurly_token_id) ->
				if err
					$scope.error = err.message
				else
					$http.post("/user/subscription/create", {_csrf: window.csrfToken, recurly_token_id:recurly_token_id.id})
					.success ->
						console.log "success"


