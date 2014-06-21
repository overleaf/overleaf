define [
	"base"
], (App) ->
	App.controller "FileTreeEntityController", ["$scope", ($scope) ->
		$scope.select = ($event) ->
			ide.fileTreeManager.forEachEntity (entity) ->
				entity.selected = false
			$scope.entity.selected = true
	]