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
						monthly: "€12"
						annual: "€144"
					professional:
						monthly: "€25"
						annual: "€300"
						
				GBP:
					symbol: "£"
					student:
						monthly: "£6"
						annual: "£60"
					collaborator:
						monthly: "£10"
						annual: "£120"
					professional:
						monthly: "£22"
						annual: "£264"
		}
	



	App.controller "PlansController", ($scope, $modal, event_tracking, abTestManager, MultiCurrencyPricing, $http) ->
		
		buckets = [
			{ bucketName:"7d", queryString: "_free_trial_7_days", trial_len:7 }
			{ bucketName:"14d", queryString: "_free_trial_14_days", trial_len:14 }
		]
		bucket = abTestManager.getABTestBucket "trial_len", buckets

		$scope.trial_len = bucket.trial_len
		$scope.planQueryString = bucket.queryString

		$scope.ui =
			view: "monthly"

		$scope.plans = MultiCurrencyPricing.plans
		$scope.currencyCode = MultiCurrencyPricing.currencyCode

		$scope.changeCurreny = (newCurrency)->
			$scope.currencyCode = newCurrency

		$scope.signUpNowClicked = (plan, annual)->
			if $scope.ui.view == "annual"
				plan = "#{plan}_annual"
			else
				abTestManager.processTestWithStep("trial_len", bucket.bucketName, 0)
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
