define [
	"base"
	"ide/permissions/PermissionsManager"
], (App, PermissionsManager) ->

	App.controller "TemplatesController", ($scope, $modal, ide) ->
		$scope.openPublishTemplateModal = () ->
			resetState = ->
				$scope.problemTalkingToTemplateApi = false

			resetState()

			modal = $modal.open {
				templateUrl: "publishProjectAsTemplateModalTemplate"
				controller: "PublishProjectAsTemplateModalController"
				scope:$scope
			}
			modal.result.then(resetState, resetState)

	App.controller "PublishProjectAsTemplateModalController", ($scope, $modalInstance, ide) ->
		user_id = ide.$scope.user.id
		$scope.templateDetails = {exists:false}

		$scope.state =
			publishInflight: false
			unpublishInflight: false

		problemTalkingToTemplateApi = ->
			$scope.problemTalkingToTemplateApi = true

		refreshPublishedStatus = ->
			ide.socket.emit "getPublishedDetails", user_id, (err, data)->
				if !data? or err? then return problemTalkingToTemplateApi()
				$scope.templateDetails = data
				$scope.templateDetails.publishedDate = moment(data.publishedDate).format("Do MMM YYYY, h:mm a")
				$scope.templateDetails.description = data.description

		refreshPublishedStatus()
		$scope.$watch $scope.problemTalkingToTemplateApi, refreshPublishedStatus

		$scope.updateProjectDescription = ->
			description = $scope.templateDetails.description
			if description?
				ide.socket.emit 'updateProjectDescription', description, (err) => 
					if err? then return problemTalkingToTemplateApi()

		$scope.publishTemplate = ->
			$scope.state.publishInflight = true
			ide.socket.emit 'publishProjectAsTemplate', user_id, (error) =>
				if err? then return problemTalkingToTemplateApi()
				refreshPublishedStatus()
				$scope.state.publishInflight = false

		$scope.unpublishTemplate = ->
			$scope.state.unpublishInflight = true
			ide.socket.emit 'unPublishProjectAsTemplate', user_id, (error) =>
				if err? then return problemTalkingToTemplateApi()
				refreshPublishedStatus()
				$scope.state.unpublishInflight = false

		$scope.cancel = () ->
			$modalInstance.dismiss()
