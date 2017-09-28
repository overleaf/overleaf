define [
	"base"
], (App) ->
	App.controller "AutoCompileOnboardingController", ($scope) ->
		recompileBtn = angular.element('#recompile')
		popover = angular.element('.onboarding__autocompile')
		{ top, left } = recompileBtn.offset()

		if $scope.ui.pdfWidth < 475
			$scope.placement = 'left'
			popover.offset({
				top: top,
				left: left - popover.width() - 11 # Width of arrow
			})
		else
			$scope.placement = 'right'
			angular.element('.onboarding__autocompile').offset({
				top: top,
				left: left + recompileBtn.width() + 11 # Width of arrow
			})


		$scope.dismiss = () ->
			$scope.onboarding.autoCompile = 'dismissed'