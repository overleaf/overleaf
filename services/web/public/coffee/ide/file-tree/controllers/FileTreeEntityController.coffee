define [
	"base"
], (App) ->
	App.controller "FileTreeEntityController", ["$scope", "ide", "$modal", ($scope, ide, $modal) ->
		$scope.select = (e) ->
			if e.ctrlKey or e.metaKey
				e.stopPropagation()
				ide.fileTreeManager.toggleMultiSelectEntity($scope.entity)
			else
				ide.fileTreeManager.selectEntity($scope.entity)
				$scope.$emit "entity:selected", $scope.entity
		
		$scope.draggableHelper = () ->
			if ide.fileTreeManager.multiSelectedCount() > 0
				return $("<div style='z-index:100'>#{ide.fileTreeManager.multiSelectedCount()} Files</div>")
			else
				return $("<div style='z-index:100'>#{$scope.entity.name}</div>")

		$scope.inputs =
			name: $scope.entity.name

		$scope.startRenaming = () ->
			$scope.entity.renaming = true

		$scope.finishRenaming = () ->
			delete $scope.entity.renaming
			name = $scope.inputs.name
			if !name? or name.length == 0
				$scope.inputs.name = $scope.entity.name
				return
			ide.fileTreeManager.renameEntity($scope.entity, name)

		$scope.$on "rename:selected", () ->
			$scope.startRenaming() if $scope.entity.selected

		$scope.openDeleteModal = () ->
			if ide.fileTreeManager.multiSelectedCount() > 0
				entities = ide.fileTreeManager.getMultiSelectedEntityChildNodes()
			else
				entities = [$scope.entity]
			$modal.open(
				templateUrl: "deleteEntityModalTemplate"
				controller:  "DeleteEntityModalController"
				resolve:
					entities: () -> entities
			)

		$scope.$on "delete:selected", () ->
			$scope.openDeleteModal() if $scope.entity.selected
	]

	App.controller "DeleteEntityModalController", [
		"$scope", "ide", "$modalInstance", "entities"
		($scope,   ide,   $modalInstance, entities) ->
			$scope.state =
				inflight: false
				
			$scope.entities = entities

			$scope.delete = () ->
				$scope.state.inflight = true
				for entity in $scope.entities
					ide.fileTreeManager.deleteEntity(entity)
				$modalInstance.close()

			$scope.cancel = () ->
				$modalInstance.dismiss('cancel')
	]
