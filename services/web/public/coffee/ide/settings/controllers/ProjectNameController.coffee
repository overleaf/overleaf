define [
	"base"
], (App) ->
	MAX_PROJECT_NAME_LENGTH = 150
	App.controller "ProjectNameController", ["$scope", "$element", "settings", "ide", ($scope, $element, settings, ide) ->
		projectNameReadOnlyEl = $element.find(".name")[0]

		$scope.state =
			renaming: false
			overflowed: false

		$scope.inputs = {}

		$scope.startRenaming = () ->
			$scope.inputs.name = $scope.project.name
			$scope.state.renaming = true
			$scope.$emit "project:rename:start"

		$scope.finishRenaming = () ->
			$scope.state.renaming = false
			newName = $scope.inputs.name
			if $scope.project.name == newName
				return
			oldName = $scope.project.name
			$scope.project.name = newName
			settings.saveProjectSettings({name: $scope.project.name})
				.error (response, statusCode) ->
					$scope.project.name = oldName
					if statusCode == 400
						ide.showGenericMessageModal("Error renaming project", response)
					else
						ide.showGenericMessageModal("Error renaming project", "Please try again in a moment")
					console.log arguments

		ide.socket.on "projectNameUpdated", (name) ->
			$scope.$apply () ->
				$scope.project.name = name

		$scope.$watch "project.name", (name) ->
			if name?
				window.document.title = name + " - Online LaTeX Editor ShareLaTeX"
				$scope.$applyAsync () ->
					# This ensures that the element is measured *after* the binding is done (i.e. project name is rendered).
					$scope.state.overflowed = (projectNameReadOnlyEl.scrollWidth > projectNameReadOnlyEl.clientWidth)
	]