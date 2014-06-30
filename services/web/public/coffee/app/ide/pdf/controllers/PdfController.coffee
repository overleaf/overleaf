define [
	"base"
	"libs/latex-log-parser"
], (App, LogParser) ->
	App.controller "PdfController", ["$scope", "$http", "ide", ($scope, $http, ide) ->
		$scope.pdf =
			url: null # Pdf Url
			error: false # Server error
			timeout: false # Server timed out
			failure: false # PDF failed to compile
			compiling: false
			uncompiled: true
			logEntries: []
			rawLog: ""
			view: null # 'pdf' 'logs'
			showRawLog: false

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
					for entry in logEntries.all
						entry.file = entry.file.replace(/^(.*)\/compiles\/[0-9a-f]{24}\/(\.\/)?/, "")
						entry.file = entry.file.replace(/^\/compile\//, "")
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
	]