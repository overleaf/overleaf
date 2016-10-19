define [
	"base",
	"directives/creditCards"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager, $http, sixpack, event_tracking, ccUtils)->
		throw new Error("Recurly API Library Missing.")  if typeof recurly is "undefined"
	
		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans

		$scope.switchToStudent = ()->
			window.location = "/user/subscription/new?planCode=student_free_trial_7_days&currency=#{$scope.currencyCode}&cc=#{$scope.data.coupon}"

		event_tracking.sendMB "subscription-form", { plan : window.plan_code }

		$scope.paymentMethod =
			value: "credit_card"

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
			mmYY: ""

		$scope.validation =
			correctCardNumber : true
			correctExpiry: true
			correctCvv: true

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
				if pricing.items.coupon.applies_for_months > 0 and pricing.items.coupon?.discount?.rate and pricing.items.coupon?.applies_for_months?
					$scope.discountMonths =  pricing.items.coupon?.applies_for_months
					$scope.discountRate =  pricing.items.coupon?.discount?.rate * 100

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

		$scope.updateExpiry = () ->
			parsedDateObj = ccUtils.parseExpiry $scope.data.mmYY
			if parsedDateObj?
				$scope.data.month = parsedDateObj.month
				$scope.data.year = parsedDateObj.year

		$scope.validateCardNumber = validateCardNumber = ->
			$scope.validation.errorFields = {}
			if $scope.data.number?.length != 0
				$scope.validation.correctCardNumber = recurly.validate.cardNumber($scope.data.number)

		$scope.validateExpiry = validateExpiry = ->
			$scope.validation.errorFields = {}
			if $scope.data.month?.length != 0 and $scope.data.year?.length != 0
				$scope.validation.correctExpiry = recurly.validate.expiry($scope.data.month, $scope.data.year)

		$scope.validateCvv = validateCvv = ->
			$scope.validation.errorFields = {}
			if $scope.data.cvv?.length != 0
				$scope.validation.correctCvv = recurly.validate.cvv($scope.data.cvv)

		$scope.inputHasError = inputHasError = (formItem) ->
			if !formItem?
				return false

			return (formItem.$touched && formItem.$invalid)

		$scope.isFormValid = isFormValid = (form) ->
			if $scope.paymentMethod.value == 'paypal' 
				return $scope.data.country != ""
			else 
				return (form.$valid and 
						$scope.validation.correctCardNumber and
						$scope.validation.correctExpiry and
						$scope.validation.correctCvv)

		$scope.updateCountry = ->
			pricing.address({country:$scope.data.country}).done()

		$scope.setPaymentMethod = setPaymentMethod = (method) ->
			$scope.paymentMethod.value = method;
			$scope.validation.errorFields = {}
			$scope.genericError = ""

		completeSubscription = (err, recurly_token_id) ->
			$scope.validation.errorFields = {}
			if err?
				event_tracking.sendMB "subscription-error", err
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
						isPaypal: $scope.paymentMethod.value == 'paypal'
						address:
							address1:    $scope.data.address1
							address2:    $scope.data.address2
							country:     $scope.data.country
							state:       $scope.data.state
							postal_code: $scope.data.postal_code
				
				event_tracking.sendMB "subscription-form-submitted", { 
					currencyCode	: postData.subscriptionDetails.currencyCode,
					plan_code		: postData.subscriptionDetails.plan_code,
					coupon_code		: postData.subscriptionDetails.coupon_code,
					isPaypal		: postData.subscriptionDetails.isPaypal
				}


				$http.post("/user/subscription/create", postData)
					.success (data, status, headers)->
						event_tracking.sendMB "subscription-submission-success"
						window.location.href = "/user/subscription/thank-you"
					.error (data, status, headers)->
						$scope.processing = false
						$scope.genericError = "Something went wrong processing the request"

		$scope.submit = ->
			$scope.processing = true
			if $scope.paymentMethod.value == 'paypal'
				opts = { description: $scope.planName }
				recurly.paypal opts, completeSubscription
			else
				recurly.token $scope.data, completeSubscription



