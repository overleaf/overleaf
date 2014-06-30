define [
	"base"
	"libs/latex-log-parser"
], (App, LogParser) ->
	App.controller "PdfController", ["$scope", "$http", "ide", "$modal", ($scope, $http, ide, $modal) ->
		autoCompile = true
		$scope.$on "doc:opened", () ->
			return if !autoCompile
			autoCompile = false
			$scope.recompile(isAutoCompile: true)

		sendCompileRequest = (options = {}) ->
			url = "/project/#{$scope.project_id}/compile"
			if options.isAutoCompile
				url += "?auto_compile=true"
			return $http.post url, {
				settingsOverride:
					rootDoc_id: options.rootDocOverride_id or null
				_csrf: window.csrfToken
			}

		parseCompileResponse = (response) ->
			# Reset everything
			$scope.pdf.error      = false
			$scope.pdf.timedout   = false
			$scope.pdf.failure    = false
			$scope.pdf.uncompiled = false
			$scope.pdf.url        = null

			if response.status == "timedout"
				$scope.pdf.timedout = true
			else if response.status == "autocompile-backoff"
				$scope.pdf.uncompiled = true
			else if response.status == "failure"
				$scope.pdf.failure = true
				fetchLogs()
			else if response.status == "success"
				$scope.pdf.url = "/project/#{$scope.project_id}/output/output.pdf?cache_bust=#{Date.now()}"
				fetchLogs()

			IGNORE_FILES = ["output.fls", "output.fdb_latexmk"]
			$scope.pdf.outputFiles = []
			for file in response.outputFiles
				if IGNORE_FILES.indexOf(file.path) == -1
					# Turn 'output.blg' into 'blg file'.
					if file.path.match(/^output\./)
						file.name = "#{file.path.replace(/^output\./, "")} file"
					else
						file.name = file.path
					$scope.pdf.outputFiles.push file

		fetchLogs = () ->
			$http.get "/project/#{$scope.project_id}/output/output.log"
				.success (log) ->
					$scope.pdf.rawLog = log
					logEntries = LogParser.parse(log, ignoreDuplicates: true)
					$scope.pdf.logEntries = logEntries
					$scope.pdf.logEntries.all = logEntries.errors.concat(logEntries.warnings).concat(logEntries.typesetting)

					$scope.pdf.logEntryAnnotations = {}
					for entry in logEntries.all
						entry.file = entry.file.replace(/^(.*)\/compiles\/[0-9a-f]{24}\/(\.\/)?/, "")
						entry.file = entry.file.replace(/^\/compile\//, "")

						entity = ide.fileTreeManager.findEntityByPath(entry.file)
						if entity?
							$scope.pdf.logEntryAnnotations[entity.id] ||= []
							$scope.pdf.logEntryAnnotations[entity.id].push {
								row: entry.line - 1
								type: if entry.level == "error" then "error" else "warning"
								text: entry.message
							}

				.error () ->
					$scope.pdf.logEntries = []
					$scope.pdf.rawLog = ""

		getRootDocOverride_id = () ->
			doc = ide.editorManager.getCurrentDocValue()
			return null if !doc?
			for line in doc.split("\n")
				match = line.match /(.*)\\documentclass/
				if match and !match[1].match /%/
					return ide.editorManager.getCurrentDocId()
			return null

		$scope.recompile = (options = {}) ->
			console.log "Recompiling", options
			return if $scope.pdf.compiling
			$scope.pdf.compiling = true

			options.rootDocOverride_id = getRootDocOverride_id()

			sendCompileRequest(options)
				.success (data) ->
					$scope.pdf.view = "pdf"
					$scope.pdf.compiling = false
					parseCompileResponse(data)
				.error () ->
					$scope.pdf.compiling = false
					$scope.pdf.error = true

		$scope.clearCache = () ->
			$http {
				url: "/project/#{$scope.project_id}/output"
				method: "DELETE"
				headers:
					"X-Csrf-Token": window.csrfToken
			}

		$scope.toggleLogs = () ->
			if !$scope.pdf.view? or $scope.pdf.view == "pdf"
				$scope.pdf.view = "logs"
			else
				$scope.pdf.view = "pdf"

		$scope.showPdf = () ->
			$scope.pdf.view = "pdf"

		$scope.toggleRawLog = () ->
			$scope.pdf.showRawLog = !$scope.pdf.showRawLog

		$scope.openOutputFile = (file) ->
			window.open("/project/#{$scope.project_id}/output/#{file.path}")

		$scope.openClearCacheModal = () ->
			modalInstance = $modal.open(
				templateUrl: "clearCacheModalTemplate"
				controller: "ClearCacheModalController"
				scope: $scope
			)
	]

	App.controller "PdfLogEntryController", ["$scope", "ide", ($scope, ide) ->
		$scope.openInEditor = (entry) ->
			console.log "OPENING", entry.file, entry.line
			entity = ide.fileTreeManager.findEntityByPath(entry.file)
			return if entity.type != "doc"
			if entry.line?
				line = entry.line - 1
			ide.editorManager.openDoc(entity, gotoLine: line)
	]

	App.controller 'ClearCacheModalController', ["$scope", "$modalInstance", ($scope, $modalInstance) ->
		$scope.state =
			inflight: false

		$scope.clear = () ->
			$scope.state.inflight = true
			$scope
				.clearCache()
				.then () ->
					$scope.state.inflight = false
					$modalInstance.close()

		$scope.cancel = () ->
			$modalInstance.dismiss('cancel')
	]