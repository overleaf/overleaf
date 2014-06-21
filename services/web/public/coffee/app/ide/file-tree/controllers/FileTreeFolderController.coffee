define [
	"base"
], (App) ->
	App.controller "FileTreeFolderController", ["$scope", ($scope) ->
		$scope.expanded = false

		$scope.toggleExpanded = () ->
			$scope.expanded = !$scope.expanded
	]