define [], () ->
	class SettingsManager
		constructor: (@ide, @$scope) ->
			@$scope.settings = window.userSettings

			if @$scope.settings.mode not in ["default", "vim", "emacs"]
				@$scope.settings.mode = "default"

			@$scope.$watch "settings.theme", (theme, oldTheme) =>
				if theme != oldTheme
					@saveSettings({theme: theme})

			@$scope.$watch "settings.fontSize", (fontSize, oldFontSize) =>
				if fontSize != oldFontSize
					@saveSettings({fontSize: parseInt(fontSize, 10)})

			@$scope.$watch "settings.mode", (mode, oldMode) =>
				if mode != oldMode
					@saveSettings({mode: mode})

			@$scope.$watch "settings.autoComplete", (autoComplete, oldAutoComplete) =>
				console.log "autoComplete", autoComplete
				if autoComplete != oldAutoComplete
					@saveSettings({autoComplete: autoComplete})

		saveSettings: (data) ->
			data._csrf = window.csrfToken
			@ide.$http.post "/user/settings", data
