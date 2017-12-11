define [
	"base"
], (App) ->
	App.controller "ShareProjectModalController", ($scope, $modalInstance, $timeout, projectMembers, projectInvites, $modal, $http, ide, validateCaptcha) ->
		$scope.inputs = {
			privileges: "readAndWrite"
			contacts: []
		}
		$scope.state = {
			error: null
			errorReason: null
			inflight: false
			startedFreeTrial: false
			invites: []
		}

		$modalInstance.opened.then () ->
			$timeout () ->
				$scope.$broadcast "open"
			, 200

		INFINITE_COLLABORATORS = -1

		$scope.refreshCanAddCollaborators = () ->
			allowedNoOfMembers = $scope.project.features.collaborators
			$scope.canAddCollaborators = (
				($scope.project.members.length + $scope.project.invites.length) < allowedNoOfMembers or allowedNoOfMembers == INFINITE_COLLABORATORS
			)
		$scope.refreshCanAddCollaborators()

		$scope.$watch "(project.members.length + project.invites.length)", (_noOfMembers) ->
			$scope.refreshCanAddCollaborators()

		$scope.autocompleteContacts = []
		do loadAutocompleteUsers = () ->
			$http.get "/user/contacts"
				.then (response) ->
					{ data } = response
					$scope.autocompleteContacts = data.contacts or []
					for contact in $scope.autocompleteContacts
						if contact.type == "user"
							if contact.last_name == "" and contact.first_name == contact.email.split("@")[0]
								# User has not set their proper name so use email as canonical display property
								contact.display = contact.email
							else
								contact.name = "#{contact.first_name} #{contact.last_name}"
								contact.display = "#{contact.name} <#{contact.email}>"
						else
							# Must be a group
							contact.display = contact.name

		getCurrentMemberEmails = () ->
			($scope.project.members || []).map (u) -> u.email

		getCurrentInviteEmails = () ->
			($scope.project.invites || []).map (u) -> u.email

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
				$scope.state.error = false
				$scope.state.errorReason = null
				$scope.state.inflight = true

				if !$scope.project.invites?
					$scope.project.invites = []

				currentMemberEmails = getCurrentMemberEmails()
				currentInviteEmails = getCurrentInviteEmails()
				do addNextMember = () ->
					if members.length == 0 or !$scope.canAddCollaborators
						$scope.state.inflight = false
						$scope.$apply()
						return

					member = members.shift()
					if member.type == "user"
						email = member.email
					else # Not an auto-complete object, so email == display
						email = member.display
					email = email.toLowerCase()

					if email in currentMemberEmails
						# Skip this existing member
						return addNextMember()

					if email in currentInviteEmails and inviteId = _.find(($scope.project.invites || []), (invite) -> invite.email == email)?._id
						request = projectInvites.resendInvite(inviteId)
					else
						request = projectInvites.sendInvite(email, $scope.inputs.privileges, $scope.grecaptchaResponse)

					request
						.then (response) ->
							{ data } = response
							if data.error
								$scope.state.error = true
								$scope.state.errorReason = "#{data.error}"
								$scope.state.inflight = false
							else
								if data.invite
									invite = data.invite
									$scope.project.invites.push invite
								else
									if data.users?
										users = data.users
									else if data.user?
										users = [data.user]
									else
										users = []
									$scope.project.members.push users...

							setTimeout () ->
								# Give $scope a chance to update $scope.canAddCollaborators
								# with new collaborator information.
								addNextMember()
							, 0
						.catch (err) ->
							$scope.state.inflight = false
							$scope.state.error = true
							if err.status? and err.status == 400
								$scope.state.errorReason = 'invalid_email'
							else
								$scope.state.errorReason = null

			validateCaptcha (response) ->
				$scope.grecaptchaResponse = response
				$timeout addMembers, 50 # Give email list a chance to update

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

		$scope.revokeInvite = (invite) ->
			$scope.state.error = null
			$scope.state.inflight = true
			projectInvites
				.revokeInvite(invite._id)
				.then () ->
					$scope.state.inflight = false
					index = $scope.project.invites.indexOf(invite)
					return if index == -1
					$scope.project.invites.splice(index, 1)
				.catch () ->
					$scope.state.inflight = false
					$scope.state.error = "Sorry, something went wrong :("

		$scope.resendInvite = (invite, event) ->
			$scope.state.error = null
			$scope.state.inflight = true
			projectInvites
				.resendInvite(invite._id)
				.then () ->
					$scope.state.inflight = false
					event.target.blur()
				.catch () ->
					$scope.state.inflight = false
					$scope.state.error = "Sorry, something went wrong resending the invite :("
					event.target.blur()

		$scope.openMakePrivateModal = () ->
			$modal.open {
				templateUrl: "makePrivateModalTemplate"
				controller:  "MakePrivateModalController"
				scope: $scope
			}

		$scope.openMakeTokenBasedModal = () ->
			$modal.open {
				templateUrl: "makeTokenBasedModalTemplate"
				controller:  "MakeTokenBasedModalController"
				scope: $scope
			}

		$scope.getReadAndWriteTokenLink = () ->
			if $scope?.project?.tokens?.readAndWrite?
				location.origin + "/" + $scope.project.tokens.readAndWrite
			else
				''

		$scope.getReadOnlyTokenLink = () ->
			if $scope?.project?.tokens?.readOnly?
				location.origin + "/read/" + $scope.project.tokens.readOnly
			else
				''

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

	App.controller "MakeTokenBasedModalController", ["$scope", "$modalInstance", "settings", "event_tracking", ($scope, $modalInstance, settings, event_tracking) ->

		$scope.makeTokenBased = () ->
			$scope.project.publicAccesLevel = "tokenBased"
			settings.saveProjectAdminSettings({publicAccessLevel: "tokenBased"})
			event_tracking.sendMB 'project-make-token-based'
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