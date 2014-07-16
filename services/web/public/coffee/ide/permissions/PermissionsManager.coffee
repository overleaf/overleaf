define [], () ->
	class PermissionsManager
		constructor: (@ide, @$scope) ->
			@$scope.permissions =
				read:  false
				write: false
				admin: false
			@$scope.$watch "permissionsLevel", (permissionsLevel) =>

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

			@$scope.hasPermission = (requestedLevel)=>
				return @$scope.permissions[requestedLevel]