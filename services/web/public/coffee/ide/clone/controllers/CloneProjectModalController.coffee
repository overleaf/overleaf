define [
	"base"
], (App) ->
	App.controller 'CloneProjectModalController', ($scope, $modalInstance, $timeout, $http, ide) ->
		$scope.inputs = 
			projectName: ide.$scope.project.name + " (Copy)"
		$scope.state =
			inflight: false
			error: false

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200
			
		cloneProject = (cloneName) ->
			$http.post("/project/#{ide.$scope.project._id}/clone", {
				_csrf: window.csrfToken
				projectName: cloneName
			})

		$scope.clone = () ->
			$scope.state.inflight = true
			$scope.state.error = false
			cloneProject($scope.inputs.projectName)
				.success (data) ->
					window.location = "/project/#{data.project_id}"
				.error (body, statusCode) ->
					$scope.state.inflight = false
					if statusCode == 400
						$scope.state.error = { message: body }
					else
						$scope.state.error = true

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')