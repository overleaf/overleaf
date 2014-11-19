define [
	"base"
	"libs/recurly-3.0.5"
], (App, recurly) ->


	App.factory "MultiCurrencyPricing", () ->
		
		currencyCode = window.recomendedCurrency

		return {
			currencyCode:currencyCode
			plans: 
				USD:
					symbol: "$"
					student:
						monthly: "$8"
						annual: "$80"
					collaborator:
						monthly: "$15"
						annual: "$180"
					professional:
						monthly: "$30"
						annual: "$360"

				EUR: 
					symbol: "€"
					student:
						monthly: "€7"
						annual: "€70"
					collaborator:
						monthly: "€14"
						annual: "€168"
					professional:
						monthly: "€28"
						annual: "€336"
						
				GBP:
					symbol: "£"
					student:
						monthly: "£6"
						annual: "£60"
					collaborator:
						monthly: "£12"
						annual: "£144"
					professional:
						monthly: "£24"
						annual: "£288"

				SEK:
					symbol: "kr"
					student:
						monthly: "60 kr"
						annual: "600 kr"
					collaborator:
						monthly: "110 kr"
						annual: "1320 kr"
					professional:
						monthly: "220 kr"
						annual: "2640 kr"
				CAD:
					symbol: "$"
					student:
						monthly: "$9"
						annual: "$90"
					collaborator:
						monthly: "$17"
						annual: "$204"
					professional:
						monthly: "$34"
						annual: "$408"
		}
	



	App.controller "PlansController", ($scope, $modal, event_tracking, abTestManager, MultiCurrencyPricing, $http) ->
		

		$scope.plans = MultiCurrencyPricing.plans
		$scope.currencyCode = MultiCurrencyPricing.currencyCode



		if MultiCurrencyPricing.currencyCode != "USD"
			currencyBuckets = [
				{ bucketName:"eu-eu", currency:MultiCurrencyPricing.currencyCode}
				{ bucketName:"eu-usd", currency:"USD"}
			]
			multiCurrencyBucket = abTestManager.getABTestBucket "multi_currency", currencyBuckets
			$scope.currencyCode = multiCurrencyBucket.currency



		$scope.trial_len = 7
		$scope.planQueryString = '_free_trial_7_days'

		$scope.ui =
			view: "monthly"



		$scope.changeCurreny = (newCurrency)->
			$scope.currencyCode = newCurrency

		$scope.signUpNowClicked = (plan, annual)->
			if multiCurrencyBucket?
				abTestManager.processTestWithStep("multi_currency", multiCurrencyBucket.bucketName, 0)

			if $scope.ui.view == "annual"
				plan = "#{plan}_annual"
			
			event_tracking.send 'subscription-funnel', 'sign_up_now_button', plan

		$scope.switchToMonthly = ->
			$scope.ui.view = "monthly"
			event_tracking.send 'subscription-funnel', 'plans-page', 'monthly-prices'
		
		$scope.switchToStudent = ->
			$scope.ui.view = "student"
			event_tracking.send 'subscription-funnel', 'plans-page', 'student-prices'

		$scope.switchToAnnual = ->
			$scope.ui.view = "annual"
			event_tracking.send 'subscription-funnel', 'plans-page', 'student-prices'
			
		$scope.openGroupPlanModal = () ->
			$modal.open {
				templateUrl: "groupPlanModalTemplate"
			}
