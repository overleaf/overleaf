define [
	"base"
], (App) ->
	App.controller "PlansController", ($scope, $modal, event_tracking, abTestManager) ->
		

		buckets = [
			{ bucketName:"30d", queryString: "_free_trial", trial_len:30 }
			{ bucketName:"14d", queryString: "_free_trial_14_days", trial_len:14 }
		]
		bucket = abTestManager.getABTestBucket "trial_len", buckets

		$scope.trial_len = bucket.trial_len
		$scope.planQueryString = bucket.queryString

		$scope.ui =
			view: "monthly"

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
