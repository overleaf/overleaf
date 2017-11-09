define [
	"base"
], (App) ->
	App.controller "LinkSharingOnboardingController", ($scope, $timeout, event_tracking) ->

		popover = angular.element('#onboarding-linksharing')
		popover.hide()

		$scope.dismiss = () ->
			$scope.onboarding.linkSharing = 'dismissed'
			event_tracking.sendMB "shown-linksharing-onboarding"

		$scope.$on 'ide:loaded', () ->
			shareBtn = angular.element('#shareButton')
			offset = shareBtn.offset()
			popover.show()
			$scope.placement = 'bottom'
			popover.offset({
				top: offset.top + 8 + shareBtn.height(),
				left: offset.left
			})
