define [
	"base"
], (App) ->
	App.controller "AnnouncementsController", ($scope, $http, event_tracking, $window) ->
		$scope.announcements = []

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
