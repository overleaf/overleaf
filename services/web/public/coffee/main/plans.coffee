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

				NOK:
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

				DKK:
					symbol: "kr"
					student:
						monthly: "50 kr"
						annual: "500 kr"
					collaborator:
						monthly: "90 kr"
						annual: "1080 kr"
					professional:
						monthly: "180 kr"
						annual: "2160 kr"

				AUD:
					symbol: "$"
					student:
						monthly: "$10"
						annual: "$100"
					collaborator:
						monthly: "$18"
						annual: "$216"
					professional:
						monthly: "$35"
						annual: "$420"

				NZD:
					symbol: "$"
					student:
						monthly: "$10"
						annual: "$100"
					collaborator:
						monthly: "$18"
						annual: "$216"
					professional:
						monthly: "$35"
						annual: "$420"
						
				CHF:
					symbol: "Fr"
					student:
						monthly: "Fr 8"
						annual: "Fr 80"
					collaborator:
						monthly: "Fr 15"
						annual: "Fr 180"
					professional:
						monthly: "Fr 30"
						annual: "Fr 360"

				SGD:
					symbol: "$"
					student:
						monthly: "$12"
						annual: "$120"
					collaborator:
						monthly: "$20"
						annual: "$240"
					professional:
						monthly: "$40"
						annual: "$480"
		}
	



	App.controller "PlansController", ($scope, $modal, event_tracking, abTestManager, MultiCurrencyPricing, $http) ->

		$scope.plans = MultiCurrencyPricing.plans
		$scope.currencyCode = MultiCurrencyPricing.currencyCode

		$scope.trial_len = 7
		$scope.planQueryString = '_free_trial_7_days'

		$scope.ui =
			view: "monthly"


		$scope.changeCurreny = (newCurrency)->
			$scope.currencyCode = newCurrency

		$scope.signUpNowClicked = (plan, annual)->
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
