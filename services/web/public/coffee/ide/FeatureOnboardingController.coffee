define [
	"base"
], (App) ->
	App.controller "FeatureOnboardingController", ($scope, settings, event_tracking) ->
		$scope.onboarding = 
			innerStep: 1
			nSteps: 4

		$scope.dismiss = () ->
			event_tracking.sendMB "shown-track-changes-onboarding"
			$scope.ui.showCollabFeaturesOnboarding = false

		$scope.gotoPrevStep = () ->
			if $scope.onboarding.innerStep > 1 
				$scope.onboarding.innerStep--;

		$scope.gotoNextStep = () ->
			if $scope.onboarding.innerStep < 4
				$scope.onboarding.innerStep++;

		# handleKeypress = (e) ->
		# 	if e.keyCode == 13
		# 		if $scope.innerStep == 1
		# 			$scope.turnCodeCheckOn()
		# 		else
		# 			$scope.dismiss()

		# $(document).on "keypress", handleKeypress

		# $scope.$on "$destroy", () -> 
		# 	$(document).off "keypress", handleKeypress