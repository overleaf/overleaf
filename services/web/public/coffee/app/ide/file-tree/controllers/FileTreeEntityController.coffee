define [
	"base"
], (App) ->
	App.controller "FileTreeEntityController", ["$scope", "ide", ($scope, ide) ->
		$scope.select = ($event) ->
			ide.fileTreeManager.forEachEntity (entity) ->
				entity.selected = false
			$scope.entity.selected = true
	]