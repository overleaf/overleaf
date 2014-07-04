define [], () ->
	class PermissionsManager
		constructor: (@ide, @$scope) ->
			@$scope.$watch "permissionsLevel", (permissionsLevel) =>
				@$scope.permissions =
					read:  false
					write: false
					admin: false
				if permissionsLevel?
					if permissionsLevel == "readOnly"
						@$scope.permissions.read = true
					else if permissionsLevel == "readAndWrite"
						@$scope.permissions.read = true
						@$scope.permissions.write = true
					else if permissionsLevel == "owner"
						@$scope.permissions.read = true
						@$scope.permissions.write = true
						@$scope.permissions.admin = true

