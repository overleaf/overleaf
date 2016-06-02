define [
	"base"
], (App) ->
	App.controller "FileTreeEntityController", ["$scope", "ide", "$modal", ($scope, ide, $modal) ->
		$scope.select = (e) ->
			if e.ctrlKey or e.metaKey
				e.stopPropagation()
				initialMultiSelectCount = ide.fileTreeManager.multiSelectedCount()
				ide.fileTreeManager.toggleMultiSelectEntity($scope.entity) == 0
				if initialMultiSelectCount == 0
					# On first multi selection, also include the current active/open file.
					ide.fileTreeManager.multiSelectSelectedEntity()
			else
				ide.fileTreeManager.selectEntity($scope.entity)
				$scope.$emit "entity:selected", $scope.entity
		
		$scope.draggableHelper = () ->
			if ide.fileTreeManager.multiSelectedCount() > 0
				return $("<strong style='z-index:100'>#{ide.fileTreeManager.multiSelectedCount()} Files</strong>")
			else
				return $("<strong style='z-index:100'>#{$scope.entity.name}</strong>")

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

		$scope.iconTypeFromName = (name) ->
			ext = name.split(".").pop()?.toLowerCase()
			if ext in ["png", "pdf", "jpg", "jpeg", "gif"]
				return "image"
			else if ext in ["csv", "xls", "xlsx"]
				return "table"
			else if ext in ["py", "r"]
				return "file-text"
			else if ext in ['bib']
				return 'book'
			else
				return "file"
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
