define [
	"base"
], (App) ->
	App.controller "FeatureOnboardingController", ($scope, settings, event_tracking) ->
		$scope.onboarding = 
			innerStep: 1
			nSteps: 4
		
		$scope.$watch "project.features.trackChangesVisible", (visible) ->
			return if !visible?
			$scope.showCollabFeaturesOnboarding = window.showTrackChangesOnboarding and visible

		$scope.dismiss = () ->
			event_tracking.sendMB "shown-track-changes-onboarding"
			$scope.$applyAsync(() -> $scope.showCollabFeaturesOnboarding = false)
			$(document).off "keydown", handleKeydown
			$(document).off "click", $scope.dismiss

		$scope.gotoPrevStep = () ->
			if $scope.onboarding.innerStep > 1 
				$scope.$applyAsync(() -> $scope.onboarding.innerStep--)

		$scope.gotoNextStep = () ->
			if $scope.onboarding.innerStep < 4
				$scope.$applyAsync(() -> $scope.onboarding.innerStep++)

		handleKeydown = (e) ->
			switch e.keyCode
				when 37 then $scope.gotoPrevStep()     # left directional key
				when 39, 13 then $scope.gotoNextStep() # right directional key, enter
				when 27 then $scope.dismiss()          # escape

		$(document).on "keydown", handleKeydown
		$(document).on "click", $scope.dismiss

		$scope.$on "$destroy", () -> 
			$(document).off "keydown", handleKeydown
			$(document).off "click", $scope.dismiss