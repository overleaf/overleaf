define [
	"base"
	"ide/file-tree/FileTreeManager"
	"ide/directives/layout"
	"ide/services/ide"
	"directives/focus"
	"directives/fineUpload"
	"directives/onEnter"
], (
	App
	FileTreeManager
) ->
	App.controller "IdeController", ["$scope", "$timeout", "ide", ($scope, $timeout, ide) ->
		$scope.state = {
			loading: true
			load_progress: 40
		}

		window._ide = ide

		ide.project_id = $scope.project_id = window.project_id
		ide.$scope = $scope
		ide.socket = io.connect null,
				reconnect: false
				"force new connection": true

		ide.fileTreeManager = new FileTreeManager(ide, $scope)

		ide.socket.on "connect", () ->
			$scope.$apply () ->
				$scope.state.load_progress = 80

			joinProject = () =>
				ide.socket.emit 'joinProject', {
					project_id: ide.project_id
				}, (err, project, permissionsLevel, protocolVersion) =>
					if $scope.protocolVersion? and $scope.protocolVersion != protocolVersion
						location.reload(true)

					$scope.$apply () ->
						$scope.protocolVersion = protocolVersion
						$scope.project = project
						$scope.state.load_progress = 100
						$scope.state.loading = false

						$scope.$emit "project:joined"

			setTimeout(joinProject, 100)	]

	angular.bootstrap(document.body, ["SharelatexApp"])