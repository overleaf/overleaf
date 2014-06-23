define [
	"base"
	"ide/file-tree/FileTreeManager"
	"ide/connection/ConnectionManager"
	"ide/directives/layout"
	"ide/services/ide"
	"directives/focus"
	"directives/fineUpload"
	"directives/onEnter"
], (
	App
	FileTreeManager
	ConnectionManager
) ->
	App.controller "IdeController", ["$scope", "$timeout", "ide", ($scope, $timeout, ide) ->
		$scope.state = {
			loading: true
			load_progress: 40
		}

		window._ide = ide

		ide.project_id = $scope.project_id = window.project_id
		ide.$scope = $scope

		ide.connectionManager = new ConnectionManager(ide, $scope)
		ide.fileTreeManager = new FileTreeManager(ide, $scope)
	]

	angular.bootstrap(document.body, ["SharelatexApp"])