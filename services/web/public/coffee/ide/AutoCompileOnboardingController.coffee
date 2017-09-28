define [
	"base"
], (App) ->
	App.controller "AutoCompileOnboardingController", ($scope) ->
		recompileBtn = angular.element('#recompile')
		{ top, left } = recompileBtn.offset()
		angular.element('.onboarding__autocompile').offset({
			top: top,
			left: left + recompileBtn.width() + 11 # Width of arrow
		})

		$scope.dismiss = () ->
			$scope.onboarding.autoCompile = 'dismissed'