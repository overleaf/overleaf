define [
	"base"
	"libs/platform"
], (App, platform) ->
	App.controller 'UniverstiesContactController', ($scope, $modal, $http) ->

		$scope.form = {}
		$scope.sent = false
		$scope.sending = false
		$scope.error = false
		$scope.contactUs = ->
			if !$scope.form.email?
				console.log "email not set"
				return
			$scope.sending = true
			ticketNumber = Math.floor((1 + Math.random()) * 0x10000).toString(32)
			data =
				_csrf : window.csrfToken
				name: $scope.form.name || $scope.form.email
				email: $scope.form.email
				labels: "#{$scope.form.source} accounts"
				message: "Please contact me with more details"
				subject: "#{$scope.form.name} - General Enquiry - #{$scope.form.position} - #{$scope.form.university}"
				inbox: "accounts"

			request = $http.post "/support", data
			
			request.catch ()->
				$scope.error = true
				$scope.$apply()

			request.then (response)->
				$scope.sent = true
				event_tracking.send 'subscription-funnel', 'plans-page', 'group-inquiry-sent'
				$scope.error = (response.status != 200)
				$scope.$apply()
