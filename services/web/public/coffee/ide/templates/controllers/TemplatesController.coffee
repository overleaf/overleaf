define [
	"base"
	"ide/permissions/PermissionsManager"
], (App, PermissionsManager) ->
	App.controller "TemplatesController", ($scope, $modal, ide) ->
		$scope.showPublishTemplateLinkInSideBar = ide.$scope.hasPermission("admin")

		$scope.openPublishTemplateModal = () ->
			console.log "open"
			$modal.open {
				templateUrl: "publishProjectAsTemplateModalTemplate"
				controller: "PublishProjectAsTemplateModalController"
				resolve:
					diff: () -> $scope.trackChanges.diff
			}

	App.controller "PublishProjectAsTemplateModalController", ($scope, $modalInstance, ide) ->
		permissionsManager = new PermissionsManager(ide, $scope)
		user_id = ide.$scope.user.id
		$scope.template = {}
		$scope.publishedDetails =
			exists:false

		$scope.state =
			publishInflight: false
			unpublishInflight: false

		refreshPublishedStatus = ->
			ide.socket.emit "getPublishedDetails", user_id, (err, data)->
				$scope.publishedDetails = data
				$scope.publishedDetails.publishedDate = moment(data.publishedDate).format("Do MMM YYYY, h:mm a")
				console.log data
				$scope.template.description = data.description

		refreshPublishedStatus()

		$scope.updateProjectDescription = ->
			description = $scope.template.description
			if description?
				ide.socket.emit 'updateProjectDescription', description, () => 

		$scope.publish = ->
			$scope.state.publishInflight = true
			ide.socket.emit 'publishProjectAsTemplate', user_id, (error, docLines, version) =>
				refreshPublishedStatus()
				$scope.state.publishInflight = false

		$scope.unpublishTemplate = ->
			$scope.state.unpublishInflight = true
			ide.socket.emit 'unPublishProjectAsTemplate', user_id, (error, docLines, version) =>
				refreshPublishedStatus()
				$scope.state.unpublishInflight = false

		$scope.cancel = () ->
			$modalInstance.dismiss()
