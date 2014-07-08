define [
	"base"
], (App) ->
	App.controller "ChatMessageController", ["$scope", "ide", ($scope, ide) ->
		$scope.hue = (user) ->
			ide.onlineUsersManager.getHueForUserId(user.id)
	]