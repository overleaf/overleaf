define [
	"base"
], (App) ->

	App.controller 'UniverstiesContactController', ($scope, $modal) ->

		$scope.form = {}
		$scope.sent = false
		$scope.sending = false
		$scope.contactUs = ->
			if !$scope.form.email?
				console.log "email not set"
				return
			$scope.sending = true
			params = 
				name: $scope.form.name || $scope.form.email
				email: $scope.form.email
				labels: $scope.form.source
				message: "Please contact me with more details"
				subject: $scope.form.subject
				about : "#{$scope.form.position || ''} #{$scope.form.university || ''}"

			Groove.createTicket params, (err, json)->
				$scope.sent = true
				$scope.$apply()
