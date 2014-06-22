define [
	"base"
], (App) ->
	App.controller "FileTreeEntityController", ["$scope", "ide", ($scope, ide) ->
		$scope.select = () ->
			ide.fileTreeManager.forEachEntity (entity) ->
				entity.selected = false
			$scope.entity.selected = true

		$scope.inputs =
			name: $scope.entity.name

		$scope.startRenaming = () ->
			$scope.entity.renaming = true

		$scope.finishRenaming = () ->
			delete $scope.entity.renaming
			ide.fileTreeManager.renameEntity($scope.entity, $scope.inputs.name)

		$scope.$on "rename:selected", () ->
			$scope.startRenaming() if $scope.entity.selected

		if $scope.entity.type == "folder"
			$scope.expanded = false

			$scope.toggleExpanded = () ->
				$scope.expanded = !$scope.expanded
	]