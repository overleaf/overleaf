define [
	"base"
], (App) ->
	App.controller 'CloneProjectModalController', ($scope, $modalInstance, $timeout, $http, ide) ->
		$scope.inputs = 
			projectName: ide.$scope.project.name + " (Copy)"
		$scope.state =
			inflight: false

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
			cloneProject($scope.inputs.projectName)
				.then (data) ->
					window.location = "/project/#{data.data.project_id}"

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')