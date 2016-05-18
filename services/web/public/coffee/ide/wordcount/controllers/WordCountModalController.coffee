define [
	"base"
], (App) ->
	App.controller 'WordCountModalController', ($scope, $modalInstance, ide, $http) ->
		$scope.status = 
			loading:true
			
		opts =
			url:"/project/#{ide.project_id}/wordcount"
			method:"GET"
			params:
				clsiserverid:ide.clsiServerId
		$http opts
			.success (data) ->
				$scope.status.loading = false
				$scope.data = data.texcount
			.error () ->
				$scope.status.error = true

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')