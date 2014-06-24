define [], () ->
	class SettingsManager
		constructor: (@ide, @$scope) ->
			@$scope.settings = window.userSettings

			@$scope.$watch "settings.theme", (theme, oldTheme) =>
				if theme != oldTheme
					@saveSettings({theme: theme})

		saveSettings: (data) ->
			data._csrf = window.csrfToken
			@ide.$http.post "/user/settings", data
