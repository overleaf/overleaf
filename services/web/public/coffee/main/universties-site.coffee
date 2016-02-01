define [
	"base"
], (App) ->

	App.controller 'UniverstiesContactController', ($scope, $modal) ->

		$scope.form = {}
		$scope.contactUs = ->
			params = 
				name: $scope.form.name || $scope.form.email
				email: $scope.form.email
				labels: $scope.form.type
				message: "Please contact me with more details"
				subject: $scope.form.subject
				about : "#{$scope.form.position || ''} #{$scope.form.university || ''} #{$scope.form.source || ''}"

			Groove.createTicket params, (err, json)->
