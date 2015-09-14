define [
	"base"
], (App) ->
	App.controller 'WordCountModalController', ($scope, $modalInstance, ide, $http) ->
		$scope.status = 
			loading:true
			
		$http.get("/project/#{ide.project_id}/wordcount")
			.success (data) ->
				$scope.status.loading = false
				$scope.data = data.texcount
				console.log $scope.data
			.error () ->
				$scope.status.error = true

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')