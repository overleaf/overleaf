define [
	"base"
], (App) ->

	App.controller "NotificationsController", ($scope, $http) ->
		for notification in $scope.notifications
			notification.hide = false

		$scope.dismiss = (notification) ->
			$http({
				url: "/notifications/#{notification._id}"
				method: "DELETE"
				headers:
					"X-Csrf-Token": window.csrfToken
			})
				.success (data) ->
					notification.hide = true
