define [
	"base"
], (App) ->
	App.controller "ChatMessageController", ["$scope", "ide", ($scope, ide) ->
		$scope.gravatarUrl = (user) ->
			email = user.email.trim().toLowerCase()
			hash = CryptoJS.MD5(email).toString()
			return "//www.gravatar.com/avatar/#{hash}?d=mm&s=50"

		$scope.hue = (user) ->
			ide.onlineUsersManager.getHueForUserId(user.id)
	]