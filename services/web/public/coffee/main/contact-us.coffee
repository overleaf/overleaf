define [
	"base"
], (App) ->


	App.controller 'ContactModal', ($scope, $modal) ->
		$scope.contactUsModal = () ->
			modalInstance = $modal.open(
				templateUrl: "supportModalTemplate"
				controller: "SupportModalController"
			)

	App.controller 'SupportModalController', ($scope, $modalInstance) ->
		$scope.form = {}
		$scope.sent = false
		$scope.sending = false
		$scope.contactUs = ->
			if !$scope.form.email?
				console.log "email not set"
				return
			$scope.sending = true
			ticketNumber = Math.floor((1 + Math.random()) * 0x10000).toString(32)
			params =
				email: $scope.form.email
				message: $scope.form.message
				subject: $scope.form.subject + " - [#{ticketNumber}]"
				about : $scope.form.project_url
				labels: "support"

			Groove.createTicket params, (err, json)->
				$scope.sent = true
				$scope.$apply()

		$scope.close = () ->
			$modalInstance.close()


	App.controller 'UniverstiesContactController', ($scope, $modal) ->

		$scope.form = {}
		$scope.sent = false
		$scope.sending = false
		$scope.contactUs = ->
			if !$scope.form.email?
				console.log "email not set"
				return
			$scope.sending = true
			ticketNumber = Math.floor((1 + Math.random()) * 0x10000).toString(32)
			params =
				name: $scope.form.name || $scope.form.email
				email: $scope.form.email
				labels: "#{$scope.form.source} accounts"
				message: "Please contact me with more details"
				subject: $scope.form.subject + " - [#{ticketNumber}]"
				about : "#{$scope.form.position || ''} #{$scope.form.university || ''}"

			Groove.createTicket params, (err, json)->
				$scope.sent = true
				$scope.$apply()
