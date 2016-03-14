define [
	"base"
], (App) ->
	MAX_PROJECT_NAME_LENGTH = 150
	App.controller "ProjectNameController", ["$scope", "settings", "ide", ($scope, settings, ide) ->
		$scope.state =
			renaming: false
		$scope.inputs = {}

		$scope.startRenaming = () ->
			$scope.inputs.name = $scope.project.name
			$scope.state.renaming = true
			$scope.$emit "project:rename:start"

		$scope.finishRenaming = () ->
			$scope.state.renaming = false
			newName = $scope.inputs.name
			if !newName? or newName.length == 0 or newName.length > MAX_PROJECT_NAME_LENGTH
				return
			if $scope.project.name == newName
				return
			$scope.project.name = newName
			settings.saveProjectSettings({name: $scope.project.name})

		ide.socket.on "projectNameUpdated", (name) ->
			$scope.$apply () ->
				$scope.project.name = name

		$scope.$watch "project.name", (name) ->
			if name?
				window.document.title = name + " - Online LaTeX Editor ShareLaTeX"
	]