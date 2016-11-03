define [
	"base"
	"ide/colors/ColorManager"
], (App, ColorManager) ->
	App.controller "ChatMessageController", ["$scope", "ide", ($scope, ide) ->
		$scope.hue = (user) ->
			ColorManager.getHueForUserId(user.id)
	]