define [
	"base"
], (App) ->
	App.controller "FeatureOnboardingController", ($scope, settings) ->
		$scope.onboarding = 
			innerStep: 1

		$scope.dismiss = () ->
			$scope.ui.leftMenuShown = false
			$scope.ui.showCodeCheckerOnboarding = false

		# handleKeypress = (e) ->
		# 	if e.keyCode == 13
		# 		if $scope.innerStep == 1
		# 			$scope.turnCodeCheckOn()
		# 		else
		# 			$scope.dismiss()

		# $(document).on "keypress", handleKeypress

		# $scope.$on "$destroy", () -> 
		# 	$(document).off "keypress", handleKeypress