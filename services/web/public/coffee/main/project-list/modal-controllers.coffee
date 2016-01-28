define [
	"base"
], (App) ->


	App.controller 'NewTagModalController', ($scope, $modalInstance, $timeout) ->
		$scope.inputs = 
			newTagName: ""

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		$scope.create = () ->
			$modalInstance.close($scope.inputs.newTagName)

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'RenameProjectModalController', ($scope, $modalInstance, $timeout, projectName) ->
		$scope.inputs = 
			projectName: projectName

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		$scope.rename = () ->
			$modalInstance.close($scope.inputs.projectName)

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'CloneProjectModalController', ($scope, $modalInstance, $timeout, project) ->
		$scope.inputs = 
			projectName: project.name + " (Copy)"
		$scope.state =
			inflight: false

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		$scope.clone = () ->
			$scope.state.inflight = true
			$scope
				.cloneProject(project, $scope.inputs.projectName)
				.then (project_id) ->
					$scope.state.inflight = false
					$modalInstance.close(project_id)

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'NewProjectModalController', ($scope, $modalInstance, $timeout, template) ->
		$scope.inputs = 
			projectName: ""
		$scope.state =
			inflight: false

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		$scope.create = () ->
			$scope.state.inflight = true
			$scope
				.createProject($scope.inputs.projectName, template)
				.then (project_id) ->
					$scope.state.inflight = false
					$modalInstance.close(project_id)

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'DeleteProjectsModalController', ($scope, $modalInstance, $timeout, projects) ->
		$scope.projectsToDelete = projects.filter (project) -> project.accessLevel == "owner"
		$scope.projectsToLeave = projects.filter (project) -> project.accessLevel != "owner"

		if $scope.projectsToLeave.length > 0 and $scope.projectsToDelete.length > 0
			$scope.action = "Delete & Leave"
		else if $scope.projectsToLeave.length == 0 and $scope.projectsToDelete.length > 0
			$scope.action = "Delete"
		else
			$scope.action = "Leave"

		$scope.delete = () ->
			$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')


	App.controller 'UploadProjectModalController', ($scope, $modalInstance, $timeout) ->
		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

		$scope.onComplete = (error, name, response) ->
			if response.project_id?
				window.location = '/project/' + response.project_id

	App.controller 'DeleteTagModalController', ($scope, $modalInstance, $http, tag) ->
		$scope.tag = tag
		$scope.state =
			inflight: false
			error: false
		
		$scope.delete = () ->
			$scope.state.inflight = true
			$scope.state.error = false
			$http({
				method: "DELETE"
				url: "/tag/#{tag._id}"
				headers:
					"X-CSRF-Token": window.csrfToken
			})
				.success () ->
					$scope.state.inflight = false
					$modalInstance.close()
				.error () ->
					$scope.state.inflight = false
					$scope.state.error = true
		
		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')