define [
	"base"
], (App) ->
	App.controller "LinkSharingOnboardingController", ($scope, $timeout, event_tracking) ->
		$scope._shown = false

		popover = angular.element('#onboarding-linksharing')
		popover.hide()

		$scope.dismiss = () ->
			$scope.onboarding.linkSharing = 'dismissed'
			event_tracking.sendMB "shown-linksharing-onboarding"

		$scope.$on 'doc:opened', () ->
			return if $scope._shown
			shareBtn = angular.element('#shareButton')
			offset = shareBtn.offset()
			popover.show()
			$scope.placement = 'bottom'
			popover.offset({
				top: offset.top + 8 + shareBtn.height(),
				left: offset.left
			})
			$scope.shown = true
