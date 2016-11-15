define [
	"base"
], (App) ->
	App.controller "AnnouncementsController", ($scope, $http, event_tracking, $window) ->

		$scope.dataRecived = false
		announcement = null
		$http.get("/announcements").success (announcements) ->
			if announcements?[0]?
				announcement = announcements[0]
				$scope.title = announcement.title
				$scope.totalAnnouncements =  announcements.length
				$scope.dataRecived = true

		dismissannouncement = ->
			event_tracking.sendMB "announcement-alert-dismissed", {blogPostId:announcement.id}

		$scope.openLink = ->
			dismissannouncement()
			$window.location.href = announcement.url
