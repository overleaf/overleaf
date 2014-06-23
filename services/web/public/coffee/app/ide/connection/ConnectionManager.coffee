define [], () ->
	class ConnectionManager
		constructor: (@ide, @$scope) ->
			@ide.socket = io.connect null,
				reconnect: false
				"force new connection": true

			@ide.socket.on "connect", () =>
				@$scope.$apply () =>
					@$scope.state.load_progress = 80

				joinProject = () =>
					@ide.socket.emit 'joinProject', {
						project_id: @ide.project_id
					}, (err, project, permissionsLevel, protocolVersion) =>
						if @$scope.protocolVersion? and @$scope.protocolVersion != protocolVersion
							location.reload(true)

						@$scope.$apply () =>
							@$scope.protocolVersion = protocolVersion
							@$scope.project = project
							@$scope.state.load_progress = 100
							@$scope.state.loading = false

							@$scope.$emit "project:joined"

				setTimeout(joinProject, 100)