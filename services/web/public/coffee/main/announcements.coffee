define [
	"base"
], (App) ->
	App.controller "AnnouncementsController", ($scope, $http, event_tracking, $window) ->
		$scope.announcements = []
		$scope.ui =
			isOpen: false
			hasNew: false
			
		refreshAnnouncements = ->
			$http.get("/announcements").success (announcements) ->
				$scope.announcements = announcements
				
		dismissCurrentAnnouncement = ->
			event_tracking.sendMB "announcement-alert-dismissed", { blogPostId:announcement.id }

		refreshAnnouncements()

		$scope.openLink = ->
			dismissCurrentAnnouncement()
				.then(refreshAnnouncements)

			$window.open = announcement.url
