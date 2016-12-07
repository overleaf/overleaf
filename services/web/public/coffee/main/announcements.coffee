define [
	"base"
], (App) ->
	App.controller "AnnouncementsController", ($scope, $http, event_tracking, $window, _) ->
		$scope.announcements = []
		$scope.ui =
			isOpen: false
			newItems: 0
		
		refreshAnnouncements = ->
			$http.get("/announcements").success (announcements) ->
				$scope.announcements = announcements
				$scope.ui.newItems = _.filter(announcements, (announcement) -> !announcement.read).length
				
		markAnnouncementsAsRead = ->
			event_tracking.sendMB "announcement-alert-dismissed", { blogPostId: $scope.announcements[0].id }

		refreshAnnouncements()

		$scope.toggleAnnouncementsUI = ->
			$scope.ui.isOpen = !$scope.ui.isOpen

			if !$scope.ui.isOpen and $scope.ui.newItems
				$scope.ui.newItems = 0
				markAnnouncementsAsRead()


