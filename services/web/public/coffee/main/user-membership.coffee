define [
	"base"
], (App) ->
	App.controller "UserMembershipController", ($scope, queuedHttp) ->
		$scope.users = window.users
		$scope.groupSize = window.groupSize
		$scope.paths = window.paths
		$scope.selectedUsers = []

		$scope.inputs =
			addMembers:
				content: ''
				error: false
				errorMessage: null
			removeMembers:
				error: false
				errorMessage: null

		parseEmails = (emailsString)->
			regexBySpaceOrComma = /[\s,]+/
			emails = emailsString.split(regexBySpaceOrComma)
			emails = _.map emails, (email)->
				email = email.trim()
			emails = _.select emails, (email)->
				email.indexOf("@") != -1
			return emails

		$scope.addMembers = () ->
			$scope.inputs.addMembers.error = false
			$scope.inputs.addMembers.errorMessage = null
			emails = parseEmails($scope.inputs.addMembers.content)
			for email in emails
				queuedHttp
					.post(paths.addMember, {
						email: email,
						_csrf: window.csrfToken
					})
					.then (response) ->
						{ data } = response
						$scope.users.push data.user if data.user?
						$scope.inputs.addMembers.content = ""
					.catch (response) ->
						{ data } = response
						$scope.inputs.addMembers.error = true
						$scope.inputs.addMembers.errorMessage = data.error?.message

		$scope.removeMembers = () ->
			$scope.inputs.removeMembers.error = false
			$scope.inputs.removeMembers.errorMessage = null
			for user in $scope.selectedUsers
				do (user) ->
					if paths.removeInvite and user.invite and !user._id?
						url = "#{paths.removeInvite}/#{encodeURIComponent(user.email)}"
					else if paths.removeMember and user._id?
						url = "#{paths.removeMember}/#{user._id}"
					else
						return
					queuedHttp({
						method: "DELETE",
						url: url
						headers:
							"X-Csrf-Token": window.csrfToken
					})
						.then () ->
							index = $scope.users.indexOf(user)
							return if index == -1
							$scope.users.splice(index, 1)
						.catch (response) ->
							{ data } = response
							$scope.inputs.removeMembers.error = true
							$scope.inputs.removeMembers.errorMessage = data.error?.message
			$scope.updateSelectedUsers

		$scope.updateSelectedUsers = () ->
			$scope.selectedUsers = $scope.users.filter (user) -> user.selected

	App.controller "UserMembershipListItemController", ($scope) ->
		$scope.$watch "user.selected", (value) ->
			if value?
				$scope.updateSelectedUsers()
