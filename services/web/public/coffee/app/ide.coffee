define [
	"base"
	"ide/file-tree/FileTreeManager"
	"ide/directives/layout"
], (
	App
	FileTreeManager
) ->
	App.controller "IdeController", ["$scope", "$timeout", ($scope, $timeout) ->
		$scope.state = {
			loading: true
			load_progress: 40
		}

		window.ide = ide = {
			'$scope': $scope
		}
		ide.fileTreeManager = new FileTreeManager(ide, $scope)

		$scope.project_id = window.project_id

		ioOptions =
			reconnect: false
			"force new connection": true
		$scope.socket = io.connect null, ioOptions

		$scope.socket.on "connect", () ->
			$scope.$apply () ->
				$scope.state.load_progress = 80

			joinProject = () =>
				$scope.socket.emit 'joinProject', {
					project_id: $scope.project_id
				}, (err, project, permissionsLevel, protocolVersion) =>
					if $scope.protocolVersion? and $scope.protocolVersion != protocolVersion
						location.reload(true)

					$scope.$apply () ->
						$scope.protocolVersion = protocolVersion
						$scope.project = project
						$scope.state.load_progress = 100
						$scope.state.loading = false

						$scope.$emit "project:joined"

						console.log "Project", $scope.project, $scope.rootFolder

			setTimeout(joinProject, 100)	]

	angular.bootstrap(document.body, ["SharelatexApp"])