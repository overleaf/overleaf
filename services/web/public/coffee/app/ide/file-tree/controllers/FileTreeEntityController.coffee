define [
	"base"
], (App) ->
	App.controller "FileTreeEntityController", ["$scope", "ide", "$modal", ($scope, ide, $modal) ->
		$scope.select = () ->
			ide.fileTreeManager.selectEntity($scope.entity)

		$scope.inputs =
			name: $scope.entity.name

		$scope.startRenaming = () ->
			$scope.entity.renaming = true

		$scope.finishRenaming = () ->
			delete $scope.entity.renaming
			ide.fileTreeManager.renameEntity($scope.entity, $scope.inputs.name)

		$scope.$on "rename:selected", () ->
			$scope.startRenaming() if $scope.entity.selected

		$scope.openDeleteModal = () ->
			$modal.open(
				templateUrl: "deleteEntityModalTemplate"
				controller:  "DeleteEntityModalController"
				scope: $scope
			)

		$scope.$on "delete:selected", () ->
			$scope.openDeleteModal() if $scope.entity.selected
	]

	App.controller "DeleteEntityModalController", [
		"$scope", "ide", "$modalInstance",
		($scope,   ide,   $modalInstance) ->
			$scope.state =
				inflight: false

			$scope.delete = () ->
				$scope.state.inflight = true
				ide.fileTreeManager
					.deleteEntity($scope.entity)
					.success () ->
						$scope.state.inflight = false
						$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]
