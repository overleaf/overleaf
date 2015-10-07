define [
	"base"
], (App) ->
	App.controller "ShareProjectModalController", ($scope, $modalInstance, $timeout, projectMembers, $modal, $http) ->
		$scope.inputs = {
			privileges: "readAndWrite"
			email: ""
		}
		$scope.state = {
			error: null
			inflight: false
			startedFreeTrial: false
		}

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		INFINITE_COLLABORATORS = -1
		$scope.$watch "project.members.length", (noOfMembers) ->
			allowedNoOfMembers = $scope.project.features.collaborators
			$scope.canAddCollaborators = noOfMembers < allowedNoOfMembers or allowedNoOfMembers == INFINITE_COLLABORATORS

		$scope.$watchCollection "inputs.contacts", (value) ->
			console.log "EMAILS", value
		
		$scope.autocompleteContacts = []
		do loadAutocompleteUsers = () ->
			$http.get "/user/contacts"
				.success (data) ->
					console.log "Got contacts", data
					$scope.autocompleteContacts = data.contacts or []
		
		$scope.filterAutocompleteUsers = ($query) ->
			return $scope.autocompleteContacts.filter (user) ->
				for text in [user.name, user.email]
					if text?.toLowerCase().indexOf($query.toLowerCase()) > -1
						return true
				return false

		$scope.addMembers = () ->
			$timeout -> # Give email list a chance to update
				return if $scope.inputs.contacts.length == 0

				emails = $scope.inputs.contacts.map (contact) -> contact.email
				$scope.inputs.contacts = []
				$scope.state.error = null
				$scope.state.inflight = true
				
				console.log "Adding emails", emails

				do addNextMember = () ->
					if emails.length == 0 or !$scope.canAddCollaborators
						$scope.state.inflight = false
						$scope.$apply()
						return
					
					email = emails.shift()
					projectMembers
						.addMember(email, $scope.inputs.privileges)
						.success (data) ->
							if data?.user # data.user is false if collaborator limit is hit.
								$scope.project.members.push data.user
								setTimeout () ->
									# Give $scope a chance to update $scope.canAddCollaborators
									# with new collaborator information.
									addNextMember()
								, 0
						.error () ->
							$scope.state.inflight = false
							$scope.state.error = "Sorry, something went wrong :("


		$scope.removeMember = (member) ->
			$scope.state.error = null
			$scope.state.inflight = true
			projectMembers
				.removeMember(member)
				.success () ->
					$scope.state.inflight = false
					index = $scope.project.members.indexOf(member)
					return if index == -1
					$scope.project.members.splice(index, 1)
				.error () ->
					$scope.state.inflight = false
					$scope.state.error = "Sorry, something went wrong :("

		$scope.openMakePublicModal = () ->
			$modal.open {
				templateUrl: "makePublicModalTemplate"
				controller:  "MakePublicModalController"
				scope: $scope
			}

		$scope.openMakePrivateModal = () ->
			$modal.open {
				templateUrl: "makePrivateModalTemplate"
				controller:  "MakePrivateModalController"
				scope: $scope
			}

		$scope.done = () ->
			$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss()

	App.controller "MakePublicModalController", ["$scope", "$modalInstance", "settings", ($scope, $modalInstance, settings) ->
		$scope.inputs = {
			privileges: "readAndWrite"
		}

		$scope.makePublic = () ->
			$scope.project.publicAccesLevel = $scope.inputs.privileges
			settings.saveProjectSettings({publicAccessLevel: $scope.inputs.privileges})
			$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss()
	]

	App.controller "MakePrivateModalController", ["$scope", "$modalInstance", "settings", ($scope, $modalInstance, settings) ->
		$scope.makePrivate = () ->
			$scope.project.publicAccesLevel = "private"
			settings.saveProjectSettings({publicAccessLevel: "private"})
			$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss()
	]