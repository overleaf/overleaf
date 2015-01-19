define [
	"base"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager, $http)->
		throw new Error("Recurly API Library Missing.")  if typeof recurly is "undefined"
	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans

		$scope.switchToStudent = ()->
			window.location = "/user/subscription/new?planCode=student&currency=#{$scope.currencyCode}"


		$scope.paymentMethod = "credit_card"

		$scope.data =
			number: ""
			month: ""
			year: ""
			cvv: ""
			first_name: ""
			last_name: ""
			postal_code: ""
			address1 : ""
			address2 : ""
			city:""
			country:window.countryCode


		$scope.validation =
			correctCardNumber : true
			correctExpiry: true
			correctCvv:true

		$scope.processing = false

		recurly.configure window.recurlyApiKey

		pricing = recurly.Pricing()
		window.pricing = pricing

		pricing.plan(window.plan_code, { quantity: 1 }).address({country: $scope.data.country}).tax({tax_code: 'digital', vat_number: ''}).currency($scope.currencyCode).done()

		pricing.on "change", =>
			$scope.planName = pricing.items.plan.name
			$scope.price = pricing.price
			$scope.trialLength = pricing.items.plan.trial.length
			$scope.billingCycleType = if pricing.items.plan.period.interval == "months" then "month" else "year"
			$scope.$apply()

		$scope.applyCoupon = ->
			pricing.coupon($scope.data.coupon).done()

		$scope.changeCurrency = (newCurrency)->
			$scope.currencyCode = newCurrency
			pricing.currency(newCurrency).done()

		$scope.validateCardNumber = validateCardNumber = ->
			if $scope.data.number?.length != 0
				$scope.validation.correctCardNumber = recurly.validate.cardNumber($scope.data.number)

		$scope.validateExpiry = validateExpiry = ->
			if $scope.data.month?.length != 0 and $scope.data.year?.length != 0
				$scope.validation.correctExpiry = recurly.validate.expiry($scope.data.month, $scope.data.year)

		$scope.validateCvv = validateCvv = ->
			if $scope.data.cvv?.length != 0
				$scope.validation.correctCvv = recurly.validate.cvv($scope.data.cvv)

		$scope.updateCountry = ->
			pricing.address({country:$scope.data.country}).done()

		$scope.changePaymentMethod = (paymentMethod)->
			if paymentMethod == "paypal"
				$scope.usePaypal = true
			else
				$scope.usePaypal = false

		completeSubscription = (err, recurly_token_id) ->
			$scope.validation.errorFields = {}
			if err?
				$scope.genericError = err.message
				_.each err.fields, (field)-> $scope.validation.errorFields[field] = true
			else
				postData =
					_csrf: window.csrfToken
					recurly_token_id:recurly_token_id.id
					subscriptionDetails:
						currencyCode:pricing.items.currency
						plan_code:pricing.items.plan.code
				$http.post("/user/subscription/create", postData)
				.success (data, status, headers)->
					window.location.href = "/user/subscription/thank-you"
				.error (data, status, headers)->
					$scope.processing = false
					$scope.genericError = "Something went wrong processing the request"

		$scope.submit = ->
			$scope.processing = true
			if $scope.paymentMethod == 'paypal'
				opts = { description: $scope.planName }
				recurly.paypal opts, completeSubscription
			else
				recurly.token $scope.data, completeSubscription



