define [
	"base"
], (App) ->
	App.controller "ProjectNameController", ["$scope", "settings", "ide", ($scope, settings, ide) ->
		$scope.state =
			renaming: false
		$scope.inputs = {}

		$scope.startRenaming = () ->
			$scope.inputs.name = $scope.project.name
			$scope.state.renaming = true
			$scope.$emit "project:rename:start"

		$scope.finishRenaming = () ->
			$scope.project.name = $scope.inputs.name
			settings.saveProjectSettings({name: $scope.inputs.name})
			$scope.state.renaming = false

		ide.socket.on "projectNameUpdated", (name) ->
			$scope.$apply () ->
				$scope.project.name = name

		$scope.$watch "project.name", (name) ->
			if name?
				window.document.title = name + " - Online LaTeX Editor ShareLaTeX"
	]