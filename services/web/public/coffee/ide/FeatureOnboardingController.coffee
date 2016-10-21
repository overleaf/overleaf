define [
	"base"
], (App) ->
	App.controller "FeatureOnboardingController", ($scope, $modal, event_tracking) ->
		$scope.isFeatureSettingDefined = window.userSettings.syntaxValidation?;

		$scope.innerStep = 1

		$scope.turnCodeCheckOn = () ->
			navToInnerStep2()
			
		$scope.turnCodeCheckOn = () ->
			navToInnerStep2()

		navToInnerStep2 = () ->
			$scope.innerStep = 2
			$scope.ui.leftMenuShown = true
