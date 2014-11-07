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

	App.controller "PublishProjectAsTemplateModalController", ($scope, $modalInstance, ide, $http) ->
		user_id = ide.$scope.user.id
		$scope.templateDetails = {exists:false}

		$scope.state =
			publishInflight: false
			unpublishInflight: false

		problemTalkingToTemplateApi = ->
			$scope.problemTalkingToTemplateApi = true

		refreshPublishedStatus = ->
			$http.get("/project/#{ide.project_id}/template")
				.success (data) ->
					$scope.templateDetails = data
					$scope.templateDetails.publishedDate = moment(data.publishedDate).format("Do MMM YYYY, h:mm a")
					$scope.templateDetails.description = data.description
				.error () ->
					problemTalkingToTemplateApi()

		refreshPublishedStatus()
		$scope.$watch $scope.problemTalkingToTemplateApi, (value) ->
			if value?
				refreshPublishedStatus()

		updateProjectDescription = ->
			$http.post("/project/#{ide.project_id}/template/description", {
				description: $scope.templateDetails.description
				_csrf: window.csrfToken
			})

		$scope.publishTemplate = ->
			$scope.state.publishInflight = true
			updateProjectDescription()
				.error () ->
					problemTalkingToTemplateApi()
				.success () ->
					$http
						.post("/project/#{ide.project_id}/template/publish", {
							_csrf: window.csrfToken
						})
						.error () ->
							problemTalkingToTemplateApi()
						.success () ->
							refreshPublishedStatus()
							$scope.state.publishInflight = false
					

		$scope.unpublishTemplate = ->
			$scope.state.unpublishInflight = true
			$http
				.post("/project/#{ide.project_id}/template/unpublish", {
					_csrf: window.csrfToken
				})
				.success () ->
					refreshPublishedStatus()
					$scope.state.unpublishInflight = false
				.error () ->
					problemTalkingToTemplateApi()

		$scope.cancel = () ->
			$modalInstance.dismiss()
