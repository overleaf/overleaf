define [
	"base"
], (App) ->
	App.controller "FeatureOnboardingController", ($scope, $modal, event_tracking) ->
		$scope.step = 1;

		$scope.turnCodeCheckOn = () ->
			goToStep2()
			
		$scope.turnCodeCheckOn = () ->
			goToStep2()

		goToStep2 = () ->
			$scope.step = 2
			$scope.ui.leftMenuShown = true
