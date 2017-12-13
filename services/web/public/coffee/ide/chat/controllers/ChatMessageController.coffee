define [
	"base"
	"ide/colors/ColorManager"
], (App, ColorManager) ->
	App.controller "ChatMessageController", ["$scope", "ide", ($scope, ide) ->
		hue = (user) ->
			if !user?
				return 0
			else
				return ColorManager.getHueForUserId(user.id)

		$scope.getMessageStyle = (user) ->
				"border-color"     : "hsl(#{ hue(user) }, 70%, 70%)"
				"background-color" : "hsl(#{ hue(user) }, 60%, 97%)"

		$scope.getArrowStyle = (user) ->
				"border-color"     : "hsl(#{ hue(user) }, 70%, 70%)"
	]