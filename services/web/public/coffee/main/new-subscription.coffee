define [
	"base",
	"directives/creditCards"
	"libs/recurly-4.8.5"
], (App)->

	App.controller "NewSubscriptionController", ($scope, MultiCurrencyPricing, abTestManager, $http, sixpack, event_tracking, ccUtils)->
		throw new Error("Recurly API Library Missing.")  if typeof recurly is "undefined"

		$scope.currencyCode = MultiCurrencyPricing.currencyCode
		$scope.plans = MultiCurrencyPricing.plans

		$scope.switchToStudent = ()->
			currentPlanCode = window.plan_code
			planCode = currentPlanCode.replace('collaborator', 'student')
			event_tracking.sendMB 'subscription-form-switch-to-student', { plan: window.plan_code }
			window.location = "/user/subscription/new?planCode=#{planCode}&currency=#{$scope.currencyCode}&cc=#{$scope.data.coupon}"

		event_tracking.sendMB "subscription-form", { plan : window.plan_code }

		$scope.paymentMethod =
			value: "credit_card"

		$scope.data =
			first_name: ""
			last_name: ""
			postal_code: ""
			address1 : ""
			address2 : ""
			state:""
			city:""
			country:window.countryCode
			coupon: window.couponCode
			
		$scope.validation = {}

		$scope.processing = false

		recurly.configure 
			publicKey: window.recurlyApiKey
			style: 
				all: 
					fontFamily: '"Open Sans", sans-serif',
					fontSize: '16px',
					fontColor: '#7a7a7a'
				month: 
					placeholder: 'MM'
				year: 
					placeholder: 'YY'
				cvv:
					placeholder: 'CVV'


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


		$scope.inputHasError = inputHasError = (formItem) ->
			if !formItem?
				return false

			return (formItem.$touched && formItem.$invalid)

		$scope.isFormValid = isFormValid = (form) ->
			if $scope.paymentMethod.value == 'paypal' 
				return $scope.data.country != ""
			else 
				return form.$valid

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
					.then ()->
						event_tracking.sendMB "subscription-submission-success"
						window.location.href = "/user/subscription/thank-you"
					.catch ()->
						$scope.processing = false
						$scope.genericError = "Something went wrong processing the request"

		$scope.submit = ->
			$scope.processing = true
			if $scope.paymentMethod.value == 'paypal'
				opts = { description: $scope.planName }
				recurly.paypal opts, completeSubscription
			else
				recurly.token $scope.data, completeSubscription



