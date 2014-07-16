define [
	"base"
	"ide/permissions/PermissionsManager"
], (App, PermissionsManager) ->
	App.controller "TemplatesController", ($scope, $modal, ide) ->
		$scope.openPublishTemplateModal = () ->
			$modal.open {
				templateUrl: "publishProjectAsTemplateModalTemplate"
				controller: "PublishProjectAsTemplateModalController"
			}

	App.controller "PublishProjectAsTemplateModalController", ($scope, $modalInstance, ide) ->

		user_id = ide.$scope.user.id
		$scope.template = {}
		$scope.publishedDetails =
			exists:false
		$scope.problemTalkingToTemplateApi = false

		problemTalkingToTemplateApi = ->
			$scope.problemTalkingToTemplateApi = true

		successTalkingToTemplateApi = ->
			$scope.problemTalkingToTemplateApi = true

		$scope.state =
			publishInflight: false
			unpublishInflight: false

		refreshPublishedStatus = ->

			ide.socket.emit "getPublishedDetails", user_id, (err, data)->
				if !data? or err? then return problemTalkingToTemplateApi() else successTalkingToTemplateApi()
				$scope.publishedDetails = data
				$scope.publishedDetails.publishedDate = moment(data.publishedDate).format("Do MMM YYYY, h:mm a")
				$scope.template.description = data.description

		refreshPublishedStatus()

		$scope.updateProjectDescription = ->
			description = $scope.template.description
			if description?
				ide.socket.emit 'updateProjectDescription', description, (err) => 
					if err? then return problemTalkingToTemplateApi() else successTalkingToTemplateApi()

		$scope.publishTemplate = ->
			$scope.state.publishInflight = true
			ide.socket.emit 'publishProjectAsTemplate', user_id, (error) =>
				if err? then return problemTalkingToTemplateApi() else successTalkingToTemplateApi()
				refreshPublishedStatus()
				$scope.state.publishInflight = false

		$scope.unpublishTemplate = ->
			$scope.state.unpublishInflight = true
			ide.socket.emit 'unPublishProjectAsTemplate', user_id, (error) =>
				if err? then return problemTalkingToTemplateApi() else successTalkingToTemplateApi()
				refreshPublishedStatus()
				$scope.state.unpublishInflight = false

		$scope.cancel = () ->
			$modalInstance.dismiss()
