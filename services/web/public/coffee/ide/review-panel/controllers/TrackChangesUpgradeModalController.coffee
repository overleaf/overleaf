define [
	"base"
], (App) ->
	App.controller "TrackChangesUpgradeModalController", ($scope, $modalInstance) ->
		$scope.cancel = () ->
			$modalInstance.dismiss()
			
		$scope.startFreeTrial = (source) ->
			ga?('send', 'event', 'subscription-funnel', 'upgraded-free-trial', source)
			window.open("/user/subscription/new?planCode=student_free_trial_7_days")
			$scope.startedFreeTrial = true