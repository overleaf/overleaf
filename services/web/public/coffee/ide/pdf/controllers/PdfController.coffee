define [
	"base"
	"libs/latex-log-parser"
], (App, LogParser) ->
	App.controller "PdfController", ["$scope", "$http", "ide", "$modal", "synctex", ($scope, $http, ide, $modal, synctex) ->
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
						entry.file = normalizeFilePath(entry.file)

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

		normalizeFilePath = (path) ->
			path = path.replace(/^(.*)\/compiles\/[0-9a-f]{24}\/(\.\/)?/, "")
			path = path.replace(/^\/compile\//, "")

			rootDocDirname = ide.fileTreeManager.getRootDocDirname()
			if rootDocDirname?
				path = path.replace(/^\.\//, rootDocDirname + "/")

			return path

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

		$scope.syncToCode = (position) ->
			console.log "SYNCING VIA DBL CLICK", position
			synctex
				.syncToCode(position)
				.then (data) ->
					{doc, line} = data
					ide.editorManager.openDoc(doc, gotoLine: line)

	]

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
		$scope.showControls = true
		$scope.$on "layout:pdf:resize", (event, data) ->
			if data.east.initClosed
				$scope.showControls = false
			else
				$scope.showControls = true
			setTimeout () ->
				$scope.$digest()
			, 0

		$scope.syncToPdf = () ->
			synctex
				.syncToPdf($scope.editor.cursorPosition)
				.then (highlights) ->
					$scope.pdf.highlights = highlights

		$scope.syncToCode = () ->
			synctex
				.syncToCode($scope.pdf.position, includeVisualOffset: true)
				.then (data) ->
					{doc, line} = data
					console.log "OPENING DOC", doc, line
					ide.editorManager.openDoc(doc, gotoLine: line)
	]

	App.controller "PdfLogEntryController", ["$scope", "ide", ($scope, ide) ->
		$scope.openInEditor = (entry) ->
			console.log "OPENING", entry.file, entry.line
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