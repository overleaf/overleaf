define [
	"base"
], (App) ->
	App.controller 'RenameProjectModalController', ($scope, $modalInstance, $timeout, project, queuedHttp) ->
		$scope.inputs = 
			projectName: project.name
		
		$scope.state =
			inflight: false
			error: false

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		$scope.rename = () ->
			$scope.state.inflight = true
			$scope.state.error = false
			$scope
				.renameProject(project, $scope.inputs.projectName)
				.then () ->
					$scope.state.inflight = false
					$scope.state.error = false
					$modalInstance.close()
				.catch (body, statusCode) ->
					$scope.state.inflight = false
					if statusCode == 400
						$scope.state.error = { message: body }
					else
						$scope.state.error = true

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'CloneProjectModalController', ($scope, $modalInstance, $timeout, project) ->
		$scope.inputs = 
			projectName: project.name + " (Copy)"
		$scope.state =
			inflight: false
			error: false

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		$scope.clone = () ->
			$scope.state.inflight = true
			$scope
				.cloneProject(project, $scope.inputs.projectName)
				.then () ->
					$scope.state.inflight = false
					$scope.state.error = false
					$modalInstance.close()
				.catch (body, statusCode) ->
					$scope.state.inflight = false
					if statusCode == 400
						$scope.state.error = { message: body }
					else
						$scope.state.error = true

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'NewProjectModalController', ($scope, $modalInstance, $timeout, template) ->
		$scope.inputs = 
			projectName: ""
		$scope.state =
			inflight: false
			error: false

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		$scope.create = () ->
			$scope.state.inflight = true
			$scope.state.error = false
			$scope
				.createProject($scope.inputs.projectName, template)
				.then (data) ->
					$scope.state.inflight = false
					$scope.state.error = false
					$modalInstance.close(data.project_id)
				.catch (body, statusCode) ->
					$scope.state.inflight = false
					if statusCode == 400
						$scope.state.error = { message: body }
					else
						$scope.state.error = true

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')

	App.controller 'DeleteProjectsModalController', ($scope, $modalInstance, $timeout, projects) ->
		$scope.projectsToDelete = projects.filter (project) -> project.accessLevel == "owner"
		$scope.projectsToLeave = projects.filter (project) -> project.accessLevel != "owner"

		if $scope.projectsToLeave.length > 0 and $scope.projectsToDelete.length > 0
			$scope.action = "delete-and-leave"
		else if $scope.projectsToLeave.length == 0 and $scope.projectsToDelete.length > 0
			$scope.action = "delete"
		else
			$scope.action = "leave"

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
