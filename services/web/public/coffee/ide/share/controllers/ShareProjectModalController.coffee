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
					$scope.autocompleteContacts = data.contacts or []
					for contact in $scope.autocompleteContacts
						if contact.type == "user"
							if contact.last_name == "" and contact.first_name = contact.email.split("@")[0]
								# User has not set their proper name so use email as canonical display property
								contact.name = ""
								contact.display = contact.email
							else
								contact.name = "#{contact.first_name} #{contact.last_name}"
								contact.display = "#{contact.name} <#{contact.email}>"
						else
							# Must be a group
							contact.display = contact.name

		$scope.filterAutocompleteUsers = ($query) ->
			return $scope.autocompleteContacts.filter (contact) ->
				for text in [contact.name, contact.email]
					if text?.toLowerCase().indexOf($query.toLowerCase()) > -1
						return true
				return false

		$scope.addMembers = () ->
			$timeout -> # Give email list a chance to update
				return if $scope.inputs.contacts.length == 0

				console.warn "Ignoring groups for now"
				emails = $scope.inputs.contacts.filter (contact) -> contact.type == "user"
				emails = emails.map (contact) -> contact.email
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