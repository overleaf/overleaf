define [
	"base"
], (App) ->
	App.controller "ShareProjectModalController", ($scope, $modalInstance, $timeout, projectMembers, projectInvites, $modal, $http) ->
		$scope.inputs = {
			privileges: "readAndWrite"
			contacts: []
		}
		$scope.state = {
			error: null
			inflight: false
			startedFreeTrial: false
			invites: []
		}

		$modalInstance.opened.then () ->
			getOutstandingInvites()
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		INFINITE_COLLABORATORS = -1
		$scope.$watch "project.members.length", (noOfMembers) ->
			allowedNoOfMembers = $scope.project.features.collaborators
			$scope.canAddCollaborators = noOfMembers < allowedNoOfMembers or allowedNoOfMembers == INFINITE_COLLABORATORS

		$scope.autocompleteContacts = []
		do loadAutocompleteUsers = () ->
			$http.get "/user/contacts"
				.success (data) ->
					$scope.autocompleteContacts = data.contacts or []
					for contact in $scope.autocompleteContacts
						if contact.type == "user"
							if contact.last_name == "" and contact.first_name = contact.email.split("@")[0]
								# User has not set their proper name so use email as canonical display property
								contact.display = contact.email
							else
								contact.name = "#{contact.first_name} #{contact.last_name}"
								contact.display = "#{contact.name} <#{contact.email}>"
						else
							# Must be a group
							contact.display = contact.name

		getCurrentMemberEmails = () ->
			$scope.project.members.map (u) -> u.email

		getOutstandingInvites = (callback) ->
			projectInvites.getInvites().then(
				(response) ->
					$scope.state.invites = response?.data?.invites
				, (response) ->
					console.error response
			)
		window._x = getOutstandingInvites

		$scope.filterAutocompleteUsers = ($query) ->
			currentMemberEmails = getCurrentMemberEmails()
			return $scope.autocompleteContacts.filter (contact) ->
				if contact.email? and contact.email in currentMemberEmails
					return false
				for text in [contact.name, contact.email]
					if text?.toLowerCase().indexOf($query.toLowerCase()) > -1
						return true
				return false

		$scope.addMembers = () ->
			addMembers = () ->
				return if $scope.inputs.contacts.length == 0

				members = $scope.inputs.contacts
				$scope.inputs.contacts = []
				$scope.state.error = null
				$scope.state.inflight = true

				currentMemberEmails = getCurrentMemberEmails()
				do addNextMember = () ->
					if members.length == 0 or !$scope.canAddCollaborators
						$scope.state.inflight = false
						$scope.$apply()
						return

					member = members.shift()
					if !member.type? and member.display in currentMemberEmails
						# Skip this existing member
						return addNextMember()

					# TODO: double-check if member.type == 'user' needs to be an invite
					console.log ">> inviting", member
					if member.type == "user"
						request = projectInvites.sendInvite(member.email, $scope.inputs.privileges)
					else if member.type == "group"
						request = projectMembers.addGroup(member.id, $scope.inputs.privileges)
					else # Not an auto-complete object, so email == display
						request = projectInvites.sendInvite(member.display, $scope.inputs.privileges)

					request
						.success (data) ->
							if data.invite
								invite = data.invite
								$scope.state.invites.push invite
							setTimeout () ->
								# Give $scope a chance to update $scope.canAddCollaborators
								# with new collaborator information.
								addNextMember()
							, 0
						.error () ->
							$scope.state.inflight = false
							$scope.state.error = true

			$timeout addMembers, 50 # Give email list a chance to update

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

		$scope.revokeInvite = (invite) ->
			$scope.state.error = null
			$scope.state.inflight = true
			projectInvites
				.revokeInvite(invite._id)
				.success () ->
					$scope.state.inflight = false
					index = $scope.state.invites.indexOf(invite)
					return if index == -1
					$scope.state.invites.splice(index, 1)
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
			settings.saveProjectAdminSettings({publicAccessLevel: $scope.inputs.privileges})
			$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss()
	]

	App.controller "MakePrivateModalController", ["$scope", "$modalInstance", "settings", ($scope, $modalInstance, settings) ->
		$scope.makePrivate = () ->
			$scope.project.publicAccesLevel = "private"
			settings.saveProjectAdminSettings({publicAccessLevel: "private"})
			$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss()
	]
