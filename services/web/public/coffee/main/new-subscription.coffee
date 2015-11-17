define [
	"base"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager, $http, sixpack)->
		throw new Error("Recurly API Library Missing.")  if typeof recurly is "undefined"
	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans

		$scope.switchToStudent = ()->
			window.location = "/user/subscription/new?planCode=student_free_trial_7_days&currency=#{$scope.currencyCode}&cc=#{$scope.data.coupon}"


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
			state:""
			city:""
			country:window.countryCode
			coupon: window.couponCode

 
		$scope.validation =
			correctCardNumber : true
			correctExpiry: true
			correctCvv:true

		$scope.processing = false

		recurly.configure window.recurlyApiKey

		pricing = recurly.Pricing()
		window.pricing = pricing

		initialPricing = pricing
			.plan(window.plan_code, { quantity: 1 })
			.address({country: $scope.data.country})
			.tax({tax_code: 'digital', vat_number: ''})
			.currency($scope.currencyCode)
			.coupon($scope.data.coupon)
			.done()

		pricing.on "change", =>
			$scope.planName = pricing.items.plan.name
			$scope.price = pricing.price
			$scope.trialLength = pricing.items.plan.trial?.length
			$scope.monthlyBilling = pricing.items.plan.period.length == 1
			if pricing.items?.coupon?.discount?.type == "percent"
				basePrice = parseInt(pricing.price.base.plan.unit)
				$scope.normalPrice = basePrice
				if pricing.price?.taxes[0]?.rate?
					$scope.normalPrice += (basePrice * pricing.price.taxes[0].rate)
			$scope.$apply()

		$scope.applyCoupon = ->
			pricing.coupon($scope.data.coupon).done()

		$scope.applyVatNumber = ->
			pricing.tax({tax_code: 'digital', vat_number: $scope.data.vat_number}).done()


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
				# We may or may not be in a digest loop here depending on
				# whether recurly could do validation locally, so do it async
				$scope.$evalAsync () ->
					$scope.processing = false
					$scope.genericError = err.message
					_.each err.fields, (field)-> $scope.validation.errorFields[field] = true
			else
				postData =
					_csrf: window.csrfToken
					recurly_token_id:recurly_token_id.id
					subscriptionDetails:
						currencyCode:pricing.items.currency
						plan_code:pricing.items.plan.code
						coupon_code:pricing.items?.coupon?.code || ""
				$http.post("/user/subscription/create", postData)
					.success (data, status, headers)->
						sixpack.convert "free-trial-plan", pricing.items.plan.code, ->
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



