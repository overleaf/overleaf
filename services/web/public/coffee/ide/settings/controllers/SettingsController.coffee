define [
	"base"
], (App) ->
	App.controller "SettingsController", ["$scope", "settings", "ide", ($scope, settings, ide) ->
		if $scope.settings.mode not in ["default", "vim", "emacs"]
			$scope.settings.mode = "default"
			
		if $scope.settings.pdfViewer not in ["pdfjs", "native"]
			$scope.settings.pdfViewer = "pdfjs"

		$scope.$watch "settings.theme", (theme, oldTheme) =>
			if theme != oldTheme
				settings.saveSettings({theme: theme})

		$scope.$watch "settings.fontSize", (fontSize, oldFontSize) =>
			if fontSize != oldFontSize
				settings.saveSettings({fontSize: parseInt(fontSize, 10)})

		$scope.$watch "settings.mode", (mode, oldMode) =>
			if mode != oldMode
				settings.saveSettings({mode: mode})

		$scope.$watch "settings.autoComplete", (autoComplete, oldAutoComplete) =>
			if autoComplete != oldAutoComplete
				settings.saveSettings({autoComplete: autoComplete})

		$scope.$watch "settings.pdfViewer", (pdfViewer, oldPdfViewer) =>
			if pdfViewer != oldPdfViewer
				settings.saveSettings({pdfViewer: pdfViewer})

		$scope.$watch "project.spellCheckLanguage", (language, oldLanguage) =>
			return if @ignoreUpdates
			if oldLanguage? and language != oldLanguage
				settings.saveProjectSettings({spellCheckLanguage: language})
				# Also set it as the default for the user
				settings.saveSettings({spellCheckLanguage: language})

		$scope.$watch "project.compiler", (compiler, oldCompiler) =>
			return if @ignoreUpdates
			if oldCompiler? and compiler != oldCompiler
				settings.saveProjectSettings({compiler: compiler})

		$scope.$watch "project.rootDoc_id", (rootDoc_id, oldRootDoc_id) =>
			return if @ignoreUpdates
			if oldRootDoc_id? and rootDoc_id != oldRootDoc_id
				settings.saveProjectSettings({rootDocId: rootDoc_id})


		ide.socket.on "compilerUpdated", (compiler) =>
			@ignoreUpdates = true
			$scope.$apply () =>
				$scope.project.compiler = compiler
			delete @ignoreUpdates

		ide.socket.on "spellCheckLanguageUpdated", (languageCode) =>
			@ignoreUpdates = true
			$scope.$apply () =>
				$scope.project.spellCheckLanguage = languageCode
			delete @ignoreUpdates
	]