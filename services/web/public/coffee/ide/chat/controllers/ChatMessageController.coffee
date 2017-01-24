define [
	"base"
	"ide/colors/ColorManager"
], (App, ColorManager) ->
	App.controller "ChatMessageController", ["$scope", "ide", ($scope, ide) ->
		$scope.hue = (user) ->
			if !user?
				return 0
			else
				return ColorManager.getHueForUserId(user.id)
	]