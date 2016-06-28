define [
	"base"
], (App) ->
	App.controller 'WordCountModalController', ($scope, $modalInstance, ide, $http) ->
		$scope.status = 
			loading:true

		# enable per-user containers by default
		perUserCompile = true

		opts =
			url:"/project/#{ide.project_id}/wordcount"
			method:"GET"
			params:
				clsiserverid:ide.clsiServerId
				isolated: perUserCompile
		$http opts
			.success (data) ->
				$scope.status.loading = false
				$scope.data = data.texcount
			.error () ->
				$scope.status.error = true

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')