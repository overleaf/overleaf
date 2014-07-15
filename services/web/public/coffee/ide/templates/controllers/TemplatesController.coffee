define [
	"base"
], (App) ->
	App.controller "TemplatesController", ($scope, $modal, ide) ->

		$scope.openPublishTemplateModal = () ->
			console.log "open"
			$modal.open {
				templateUrl: "publishProjectAsTemplateModalTemplate"
				controller: "PublishProjectAsTemplateModalController"
				resolve:
					diff: () -> $scope.trackChanges.diff
			}

	App.controller "PublishProjectAsTemplateModalController", ($scope, $modalInstance, diff, ide) ->
		user_id = window.user.id #TODO this is not correct, it needs to be the owners id
		$scope.template =
			description: window.project_description
		$scope.publishedDetails =
			exists:false

		$scope.state =
			publishInflight: false
			unpublishInflight: false

		refreshPublishedStatus = ->
			ide.socket.emit "getPublishedDetails", user_id, (err, data)->
				console.log "got published details"
				$scope.publishedDetails = data
				$scope.publishedDetails.publishedDate = moment(data.publishedDate).format("Do MMM YYYY, h:mm a")

		refreshPublishedStatus()

		$scope.updateProjectDescription = ->
			description = $scope.template.description
			if description?
				ide.socket.emit 'updateProjectDescription', description, () => 
					console.log "updated"

		$scope.publish = ->
			$scope.state.publishInflight = true
			ide.socket.emit 'publishProjectAsTemplate', user_id, (error, docLines, version) =>
				console.log "published"
				refreshPublishedStatus()
				$scope.state.publishInflight = false

		$scope.unpublishTemplate = ->
			$scope.state.unpublishInflight = true
			ide.socket.emit 'unPublishProjectAsTemplate', user_id, (error, docLines, version) =>
				console.log "unpublished"
				refreshPublishedStatus()
				$scope.state.unpublishInflight = false

		$scope.cancel = () ->
			$modalInstance.dismiss()
