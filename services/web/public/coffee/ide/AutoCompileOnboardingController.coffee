define [
	"base"
], (App) ->
	App.controller "AutoCompileOnboardingController", ($scope) ->
		$scope.dismiss = () ->
			$scope.onboarding.autoCompile = 'dismissed'