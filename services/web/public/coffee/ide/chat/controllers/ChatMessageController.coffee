define [
	"base"
	"ide/colors/ColorManager"
], (App, ColorManager) ->
	App.controller "ChatMessageController", ["$scope", "ide", ($scope, ide) ->
		hslColorConfigs =
			borderSaturation: window.uiConfig?.chatMessageBorderSaturation or "70%"
			borderLightness : window.uiConfig?.chatMessageBorderLightness or "70%"
			bgSaturation    : window.uiConfig?.chatMessageBgSaturation or "60%"
			bgLightness     : window.uiConfig?.chatMessageBgLightness or "97%"

		hue = (user) ->
			if !user?
				return 0
			else
				return ColorManager.getHueForUserId(user.id)

		$scope.getMessageStyle = (user) ->
			style =
				"border-color"     : "hsl(#{ hue(user) }, #{ hslColorConfigs.borderSaturation }, #{ hslColorConfigs.borderLightness })"
				"background-color" : "hsl(#{ hue(user) }, #{ hslColorConfigs.bgSaturation }, #{ hslColorConfigs.bgLightness })"
			console.log style
			return style

		$scope.getArrowStyle = (user) ->
			style =
				"border-color"     : "hsl(#{ hue(user) }, #{ hslColorConfigs.borderSaturation }, #{ hslColorConfigs.borderLightness })"
			console.log style
			return style
	]