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
			popover.css({
				top: '' + (2) + 'px',
				right: '' + (window.innerWidth - offset.left - (shareBtn.width() * 1.5) ) + 'px'
			})
