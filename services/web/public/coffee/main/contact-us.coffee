define [
	"base"
	"services/algolia-search"
	"libs/platform"
], (App, platform) ->
	App.controller 'ContactModal', ($scope, $modal) ->
		$scope.contactUsModal = () ->
			modalInstance = $modal.open(
				templateUrl: "supportModalTemplate"
				controller: "SupportModalController"
			)

	App.controller 'SupportModalController', ($scope, $modalInstance, algoliaSearch) ->
		$scope.form = {}
		$scope.sent = false
		$scope.sending = false
		$scope.suggestions = [];

		_handleSearchResults = (success, results) ->
			suggestions = for hit in results.hits
				page_underscored = hit.pageName.replace(/\s/g,'_')

				suggestion = 
					url :"/learn/kb/#{page_underscored}"
					name : hit._highlightResult.pageName.value

			$scope.$applyAsync () -> 
				$scope.suggestions = suggestions

		$scope.contactUs = ->
			if !$scope.form.email?
				console.log "email not set"
				return
			$scope.sending = true
			ticketNumber = Math.floor((1 + Math.random()) * 0x10000).toString(32)
			message = $scope.form.message
			if $scope.form.project_url?
				message	= "#{message}\n\n project_url = #{$scope.form.project_url}" 
			params =
				email: $scope.form.email
				message: message or ""
				subject: $scope.form.subject + " - [#{ticketNumber}]"
				labels: "support"
				about: "<div>browser: #{platform?.name} #{platform?.version}</div>
						<div>os: #{platform?.os?.family} #{platform?.os?.version}</div>"

			Groove.createTicket params, (err, json)->
				$scope.sent = true
				$scope.$apply()

		$scope.$watch "form.subject", (newVal, oldVal) ->
			if newVal and newVal != oldVal and newVal.length > 3
				algoliaSearch.searchKB newVal, _handleSearchResults, { 
					hitsPerPage: 3
					typoTolerance: 'strict'
				}
			else
				$scope.suggestions = [];

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


