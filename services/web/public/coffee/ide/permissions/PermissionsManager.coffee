define [], () ->
	class PermissionsManager
		constructor: (@ide, @$scope) ->
			@$scope.permissions =
				read:  false
				write: false
				admin: false
				comment: false
			@$scope.$watch "permissionsLevel", (permissionsLevel) =>

				if permissionsLevel?
					if permissionsLevel == "readOnly"
						@$scope.permissions.read = true
						@$scope.permissions.comment = true
					else if permissionsLevel == "readAndWrite"
						@$scope.permissions.read = true
						@$scope.permissions.write = true
						@$scope.permissions.comment = true
					else if permissionsLevel == "owner"
						@$scope.permissions.read = true
						@$scope.permissions.write = true
						@$scope.permissions.admin = true
						@$scope.permissions.comment = true

				if @$scope.anonymous
					@$scope.permissions.comment = false
