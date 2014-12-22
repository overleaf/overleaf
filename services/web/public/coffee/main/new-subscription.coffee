define [
	"base"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager, $http)->
		throw new Error("Recurly API Library Missing.")  if typeof recurly is "undefined"
	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans



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
			country:"GB"
		recurly.configure __api_key
		pricing = recurly.Pricing()
		#pricing.attach(document.querySelector('#pricing'))
		window.pricing = pricing

		$scope.planName = "no yet set"
		
		pricing.plan(window.plan_code, { quantity: 1 }).currency($scope.currencyCode).done()

		$scope.applyCoupon = ->
			pricing.coupon($scope.data.coupon).done()

		$scope.changeCurrency = (newCurrency)->
			$scope.currencyCode = newCurrency
			pricing.currency(newCurrency).done()

		pricing.on "change", =>
			$scope.planName = pricing.items.plan.name
			$scope.price = pricing.price.currency.symbol+pricing.price.next.total
			$scope.trialLength = pricing.items.plan.trial.length
			$scope.billingCycleType = if pricing.items.plan.period.interval == "months" then "month" else "year"
			$scope.$apply()

		$scope.submit = ->
			$scope.error = ""
			recurly.token $scope.data, (err, recurly_token_id) ->
				if err
					$scope.error = err.message
				else
					postData =
						_csrf: window.csrfToken
						recurly_token_id:recurly_token_id.id
						subscriptionDetails:
							currencyCode:"USD"
							plan_code:"student"
					$http.post("/user/subscription/create", postData)
					.success ->
						console.log "success"


