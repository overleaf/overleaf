define [
	"base"
], (App) ->
	App.controller "SubscriptionGroupMembersController", ($scope, queuedHttp) ->
		$scope.users = window.users
		$scope.groupSize = window.groupSize
		$scope.selectedUsers = []

		$scope.inputs =
			emails: ""

		parseEmails = (emailsString)->
			regexBySpaceOrComma = /[\s,]+/
			emails = emailsString.split(regexBySpaceOrComma)
			emails = _.map emails, (email)->
				email = email.trim()
			emails = _.select emails, (email)->
				email.indexOf("@") != -1
			return emails

		$scope.addMembers = () ->
			emails = parseEmails($scope.inputs.emails)
			for email in emails
				queuedHttp
					.post("/subscription/group/user", {
						email: email,
						_csrf: window.csrfToken
					})
					.success (data) ->
						$scope.users.push data.user if data.user?
						$scope.inputs.emails = ""

		$scope.removeMembers = () ->
			for user in $scope.selectedUsers
				do (user) ->
					queuedHttp({
						method: "DELETE",
						url: "/subscription/group/user/#{user._id}"
						headers:
							"X-Csrf-Token": window.csrfToken
					})
						.success () ->
							index = $scope.users.indexOf(user)
							return if index == -1
							$scope.users.splice(index, 1)
			$scope.selectedUsers = []

		$scope.updateSelectedUsers = () ->
			$scope.selectedUsers = $scope.users.filter (user) -> user.selected

	App.controller "SubscriptionGroupMemberListItemController", ($scope) ->
		$scope.$watch "user.selected", (value) ->
			if value?
				$scope.updateSelectedUsers()