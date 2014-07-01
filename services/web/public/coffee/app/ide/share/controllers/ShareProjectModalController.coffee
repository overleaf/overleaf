define [
	"base"
], (App) ->
	App.controller "ShareProjectModalController", ["$scope", "$modalInstance", "$timeout", "projectMembers", ($scope, $modalInstance, $timeout, projectMembers) ->
		$scope.inputs = {
			privileges: "readAndWrite"
			email: ""
		}
		$scope.state = {
			error: null
			inflight: false
		}

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		INFINITE_COLLABORATORS = -1
		$scope.$watch "project.members.length", (noOfMembers) ->
			allowedNoOfMembers = $scope.project.features.collaborators
			$scope.canAddCollaborators = noOfMembers < allowedNoOfMembers or allowedNoOfMembers == INFINITE_COLLABORATORS

		$scope.addMember = () ->
			console.log "EMAIL", $scope.inputs.email
			return if !$scope.inputs.email? or $scope.inputs.email == ""
			$scope.state.error = null
			$scope.state.inflight = true
			projectMembers
				.addMember($scope.inputs.email, $scope.inputs.privileges)
				.then (user) ->
					$scope.state.inflight = false
					$scope.inputs.email = ""
					console.log "GOT USER", user
					$scope.project.members.push user
				.catch () ->
					$scope.state.inflight = false
					$scope.state.error = "Sorry, something went wrong :("


		$scope.removeMember = (member) ->
			$scope.state.error = null
			$scope.state.inflight = true
			projectMembers
				.removeMember(member)
				.then () ->
					$scope.state.inflight = false
					index = $scope.project.members.indexOf(member)
					return if index == -1
					$scope.project.members.splice(index, 1)
				.catch () ->
					$scope.state.inflight = false
					$scope.state.error = "Sorry, something went wrong :("

		$scope.done = () ->
			$modalInstance.close()
	]