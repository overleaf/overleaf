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
				if autoComplete != oldAutoComplete
					@saveSettings({autoComplete: autoComplete})

			@$scope.$watch "settings.pdfViewer", (pdfViewer, oldPdfViewer) =>
				if pdfViewer != oldPdfViewer
					@saveSettings({pdfViewer: pdfViewer})

			@$scope.$watch "project.spellCheckLanguage", (language, oldLanguage) =>
				return if @ignoreUpdates
				if oldLanguage? and language != oldLanguage
					@saveProjectSettings({spellCheckLanguage: language})
					# Also set it as the default for the user
					@saveSettings({spellCheckLanguage: language})

			@$scope.$watch "project.compiler", (compiler, oldCompiler) =>
				return if @ignoreUpdates
				if oldCompiler? and compiler != oldCompiler
					@saveProjectSettings({compiler: compiler})

			@ide.socket.on "compilerUpdated", (compiler) =>
				@ignoreUpdates = true
				@$scope.$apply () =>
					@$scope.project.compiler = compiler
				delete @ignoreUpdates

			@ide.socket.on "spellCheckLanguageUpdated", (languageCode) =>
				@ignoreUpdates = true
				@$scope.$apply () =>
					@$scope.project.spellCheckLanguage = languageCode
				delete @ignoreUpdates

		saveSettings: (data) ->
			data._csrf = window.csrfToken
			@ide.$http.post "/user/settings", data

		saveProjectSettings: (data) ->
			data._csrf = window.csrfToken
			@ide.$http.post "/project/#{@ide.project_id}/settings", data
