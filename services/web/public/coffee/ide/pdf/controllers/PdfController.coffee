define [
	"base"
	"libs/latex-log-parser"
	"libs/bib-log-parser"
], (App, LogParser, BibLogParser) ->
	App.controller "PdfController", ($scope, $http, ide, $modal, synctex, event_tracking, localStorage) ->

		autoCompile = true

		# pdf.view = uncompiled | pdf | errors
		$scope.pdf.view = if $scope?.pdf?.url then 'pdf' else 'uncompiled'
		$scope.shouldShowLogs = false

		$scope.$on "project:joined", () ->
			return if !autoCompile
			autoCompile = false
			$scope.recompile(isAutoCompile: true)
			$scope.hasPremiumCompile = $scope.project.features.compileGroup == "priority"

		$scope.$on "pdf:error:display", () ->
			$scope.pdf.view = 'errors'
			$scope.pdf.renderingError = true

		$scope.draft = localStorage("draft:#{$scope.project_id}") or false
		$scope.$watch "draft", (new_value, old_value) ->
			if new_value? and old_value != new_value
				localStorage("draft:#{$scope.project_id}", new_value)

		sendCompileRequest = (options = {}) ->
			url = "/project/#{$scope.project_id}/compile"
			if options.isAutoCompile
				url += "?auto_compile=true"
			return $http.post url, {
				rootDoc_id: options.rootDocOverride_id or null
				draft: $scope.draft
				_csrf: window.csrfToken
			}

		parseCompileResponse = (response) ->
			# Reset everything
			$scope.pdf.error      = false
			$scope.pdf.timedout   = false
			$scope.pdf.failure    = false
			$scope.pdf.uncompiled = false
			$scope.pdf.projectTooLarge = false
			$scope.pdf.url        = null
			$scope.pdf.clsiMaintenance = false
			$scope.pdf.tooRecentlyCompiled = false
			$scope.pdf.renderingError = false

			if response.status == "timedout"
				$scope.pdf.view = 'errors'
				$scope.pdf.timedout = true
			else if response.status == "autocompile-backoff"
				$scope.pdf.view = 'errors'
				$scope.pdf.uncompiled = true
			else if response.status == "project-too-large"
				$scope.pdf.view = 'errors'
				$scope.pdf.projectTooLarge = true
			else if response.status == "failure"
				$scope.pdf.view = 'errors'
				$scope.pdf.failure = true
				$scope.shouldShowLogs = true
				fetchLogs()
			else if response.status == 'clsi-maintenance'
				$scope.pdf.view = 'errors'
				$scope.pdf.clsiMaintenance = true
			else if response.status == "too-recently-compiled"
				$scope.pdf.view = 'errors'
				$scope.pdf.tooRecentlyCompiled = true
			else if response.status == "success"
				$scope.pdf.view = 'pdf'
				$scope.shouldShowLogs = false
				# define the base url
				$scope.pdf.url = "/project/#{$scope.project_id}/output/output.pdf?cache_bust=#{Date.now()}"
				# add a query string parameter for the compile group
				if response.compileGroup?
					$scope.pdf.compileGroup = response.compileGroup
					$scope.pdf.url = $scope.pdf.url + "&compileGroup=#{$scope.pdf.compileGroup}"
				# make a cache to look up files by name
				fileByPath = {}
				for file in response.outputFiles
					fileByPath[file.path] = file
				# if the pdf file has a build number, pass it to the clsi
				if fileByPath['output.pdf']?.build?
					build = fileByPath['output.pdf'].build
					$scope.pdf.url = $scope.pdf.url + "&build=#{build}"

				fetchLogs(fileByPath['output.log'])

			IGNORE_FILES = ["output.fls", "output.fdb_latexmk"]
			$scope.pdf.outputFiles = []

			if !response.outputFiles?
				return
			for file in response.outputFiles
				if IGNORE_FILES.indexOf(file.path) == -1
					# Turn 'output.blg' into 'blg file'.
					if file.path.match(/^output\./)
						file.name = "#{file.path.replace(/^output\./, "")} file"
					else
						file.name = file.path
					$scope.pdf.outputFiles.push file

		fetchLogs = (outputFile) ->
			qs = if outputFile?.build? then "?build=#{outputFile.build}" else ""
			$http.get "/project/#{$scope.project_id}/output/output.log" + qs
				.success (log) ->
					#console.log ">>", log
					$scope.pdf.rawLog = log
					logEntries = LogParser.parse(log, ignoreDuplicates: true)
					#console.log ">>", logEntries
					$scope.pdf.logEntries = logEntries
					$scope.pdf.logEntries.all = logEntries.errors.concat(logEntries.warnings).concat(logEntries.typesetting)
					# # # #
					proceed = () ->
						$scope.pdf.logEntryAnnotations = {}
						for entry in logEntries.all
							if entry.file?
								entry.file = normalizeFilePath(entry.file)
								entity = ide.fileTreeManager.findEntityByPath(entry.file)
								if entity?
									$scope.pdf.logEntryAnnotations[entity.id] ||= []
									$scope.pdf.logEntryAnnotations[entity.id].push {
										row: entry.line - 1
										type: if entry.level == "error" then "error" else "warning"
										text: entry.message
									}
					# Get the biber log and parse it too
					$http.get "/project/#{$scope.project_id}/output/output.blg" + qs
						.success (log) ->
							window._s = $scope
							biberLogEntries = BibLogParser.parse(log, {})
							if $scope.pdf.logEntries
								entries = $scope.pdf.logEntries
								all = biberLogEntries.errors.concat(biberLogEntries.warnings)
								entries.all = entries.all.concat(all)
								entries.errors = entries.errors.concat(biberLogEntries.errors)
								entries.warnings = entries.warnings.concat(biberLogEntries.warnings)
							proceed()
						.error (e) ->
							# it's not an error for the output.blg file to not be present
							proceed()
					# # # #
				.error () ->
					$scope.pdf.logEntries = []
					$scope.pdf.rawLog = ""

		getRootDocOverride_id = () ->
			doc = ide.editorManager.getCurrentDocValue()
			return null if !doc?
			for line in doc.split("\n")
				match = line.match /^[^%]*\\documentclass/
				if match
					return ide.editorManager.getCurrentDocId()
			return null

		normalizeFilePath = (path) ->
			path = path.replace(/^(.*)\/compiles\/[0-9a-f]{24}\/(\.\/)?/, "")
			path = path.replace(/^\/compile\//, "")

			rootDocDirname = ide.fileTreeManager.getRootDocDirname()
			if rootDocDirname?
				path = path.replace(/^\.\//, rootDocDirname + "/")

			return path

		$scope.recompile = (options = {}) ->
			return if $scope.pdf.compiling
			$scope.pdf.compiling = true

			ide.$scope.$broadcast("flush-changes")

			options.rootDocOverride_id = getRootDocOverride_id()

			sendCompileRequest(options)
				.success (data) ->
					$scope.pdf.view = "pdf"
					$scope.pdf.compiling = false
					parseCompileResponse(data)
				.error () ->
					$scope.pdf.compiling = false
					$scope.pdf.renderingError = false
					$scope.pdf.error = true
					$scope.pdf.view = 'errors'

		# This needs to be public.
		ide.$scope.recompile = $scope.recompile

		$scope.clearCache = () ->
			$http {
				url: "/project/#{$scope.project_id}/output"
				method: "DELETE"
				headers:
					"X-Csrf-Token": window.csrfToken
			}

		$scope.toggleLogs = () ->
			$scope.shouldShowLogs = !$scope.shouldShowLogs

		$scope.showPdf = () ->
			$scope.pdf.view = "pdf"
			$scope.shouldShowLogs = false

		$scope.toggleRawLog = () ->
			$scope.pdf.showRawLog = !$scope.pdf.showRawLog

		$scope.openClearCacheModal = () ->
			modalInstance = $modal.open(
				templateUrl: "clearCacheModalTemplate"
				controller: "ClearCacheModalController"
				scope: $scope
			)

		$scope.syncToCode = (position) ->
			synctex
				.syncToCode(position)
				.then (data) ->
					{doc, line} = data
					ide.editorManager.openDoc(doc, gotoLine: line)

		$scope.switchToFlatLayout = () ->
			$scope.ui.pdfLayout = 'flat'
			$scope.ui.view = 'pdf'
			ide.localStorage "pdf.layout", "flat"

		$scope.switchToSideBySideLayout = () ->
			$scope.ui.pdfLayout = 'sideBySide'
			$scope.ui.view = 'editor'
			localStorage "pdf.layout", "split"

		if pdfLayout = localStorage("pdf.layout")
			$scope.switchToSideBySideLayout() if pdfLayout == "split"
			$scope.switchToFlatLayout() if pdfLayout == "flat"
		else
			$scope.switchToSideBySideLayout()

		$scope.startFreeTrial = (source) ->
			ga?('send', 'event', 'subscription-funnel', 'compile-timeout', source)
			window.open("/user/subscription/new?planCode=student_free_trial_7_days")
			$scope.startedFreeTrial = true

	App.factory "synctex", ["ide", "$http", "$q", (ide, $http, $q) ->
		synctex =
			syncToPdf: (cursorPosition) ->
				deferred = $q.defer()

				doc_id = ide.editorManager.getCurrentDocId()
				if !doc_id?
					deferred.reject()
					return deferred.promise
				doc = ide.fileTreeManager.findEntityById(doc_id)
				if !doc?
					deferred.reject()
					return deferred.promise
				path = ide.fileTreeManager.getEntityPath(doc)
				if !path?
					deferred.reject()
					return deferred.promise

				# If the root file is folder/main.tex, then synctex sees the
				# path as folder/./main.tex
				rootDocDirname = ide.fileTreeManager.getRootDocDirname()
				if rootDocDirname? and rootDocDirname != ""
					path = path.replace(RegExp("^#{rootDocDirname}"), "#{rootDocDirname}/.")

				{row, column} = cursorPosition

				$http({
						url: "/project/#{ide.project_id}/sync/code",
						method: "GET",
						params: {
							file: path
							line: row + 1
							column: column
						}
					})
					.success (data) ->
						deferred.resolve(data.pdf or [])
					.error (error) ->
						deferred.reject(error)

				return deferred.promise

			syncToCode: (position, options = {}) ->
				deferred = $q.defer()
				if !position?
					deferred.reject()
					return deferred.promise

				# It's not clear exactly where we should sync to if it wasn't directly
				# clicked on, but a little bit down from the very top seems best.
				if options.includeVisualOffset
					position.offset.top = position.offset.top + 80

				$http({
						url: "/project/#{ide.project_id}/sync/pdf",
						method: "GET",
						params: {
							page: position.page + 1
							h: position.offset.left.toFixed(2)
							v: position.offset.top.toFixed(2)
						}
					})
					.success (data) ->
						if data.code? and data.code.length > 0
							doc = ide.fileTreeManager.findEntityByPath(data.code[0].file)
							return if !doc?
							deferred.resolve({doc: doc, line: data.code[0].line})
					.error (error) ->
						deferred.reject(error)

				return deferred.promise

		return synctex
	]

	App.controller "PdfSynctexController", ["$scope", "synctex", "ide", ($scope, synctex, ide) ->
		@cursorPosition = null
		ide.$scope.$on "cursor:editor:update", (event, @cursorPosition) =>

		$scope.syncToPdf = () =>
			return if !@cursorPosition?
			synctex
				.syncToPdf(@cursorPosition)
				.then (highlights) ->
					$scope.pdf.highlights = highlights

		$scope.syncToCode = () ->
			synctex
				.syncToCode($scope.pdf.position, includeVisualOffset: true)
				.then (data) ->
					{doc, line} = data
					ide.editorManager.openDoc(doc, gotoLine: line)
	]

	App.controller "PdfLogEntryController", ["$scope", "ide", ($scope, ide) ->
		$scope.openInEditor = (entry) ->
			entity = ide.fileTreeManager.findEntityByPath(entry.file)
			return if !entity? or entity.type != "doc"
			if entry.line?
				line = entry.line
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
