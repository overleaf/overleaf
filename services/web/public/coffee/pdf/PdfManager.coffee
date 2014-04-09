define [
	"utils/Modal"
	"pdf/CompiledView"
	"pdf/SyncButtonsView"
	"libs/latex-log-parser"
	"libs/jquery.storage"
	"libs/underscore"
	"libs/backbone"
], (Modal, CompiledView, SyncButtonsView, LogParser) ->
	class PdfManager
		templates:
			pdfLink: $("#pdfSideBarLinkTemplate").html()

		constructor: (@ide) ->
			_.extend @, Backbone.Events
			@createSyncButtons()
			@createPdfPanel()
			@ide.editor.aceEditor.commands.addCommand
				name: "compile",
				bindKey: win: "Ctrl-Enter", mac: "Command-Enter"
				exec: (editor) =>
					@refreshPdf()
				readOnly: true

			@ide.editor.aceEditor.commands.removeCommand "replace"

		createPdfPanel: () ->
			@view = new CompiledView manager: @, ide: @ide
			@view.on "dblclick", (e) => @syncToCode(e)
			@view.render()
			if $.localStorage("layout.pdf") == "flat"
				@switchToFlatView()
			else if $.localStorage("layout.pdf") == "split"
				@switchToSplitView()
			else if $(window).width() < 1024
				@switchToFlatView()
			else
				@switchToSplitView()

		createSyncButtons: () ->
			unless @ide.userSettings.pdfViewer == "native"
				@syncButtonsView = new SyncButtonsView(ide: @ide)
				@syncButtonsView.on "click:sync-code-to-pdf", () =>
					@syncToPdf()
				@syncButtonsView.on "click:sync-pdf-to-code", () =>
					@syncToCode()
				@syncButtonsView.hide()

		switchToFlatView: (options = {showPdf: false}) ->
			@teardownSplitView()
			@setupFlatView()
			@view.toggleFlatViewButton()
			if options.showPdf
				@ide.sideBarView.selectLink "pdf"
				@ide.mainAreaManager.change "pdf"
				@view.resize()

		switchToSplitView: () ->
			@teardownFlatView()
			@setupSplitView()
			@view.toggleSplitViewButton()
			@view.resize()
			@ide.editor.setIdeToEditorPanel()

		setupFlatView: () ->
			@teardownFlatView()
			@ide.editor.switchToFlatView()
			pdfLink = $(@templates.pdfLink)
			@ide.sideBarView.addLink
				identifier : "pdf"
				before     : "history"
				element    : pdfLink
			pdfLink.on "click", (e) => @showPdfPanel()

			@ide.mainAreaManager.addArea
				identifier: "pdf"
				element: @view.$el
			@view.resize()

			@view.undelegateEvents()
			@view.delegateEvents()


		teardownFlatView: () ->
			@ide.sideBarView.removeLink("pdf")
			@ide.mainAreaManager.removeArea("pdf")
			@view.afterSwitchView()

		setupSplitView: () ->
			@ide.editor.switchToSplitView()
			@ide.editor.rightPanel.append(
				@view.$el
			)
			@view.$el.show()
			@view.resize()

			@view.undelegateEvents()
			@view.delegateEvents()

			@ide.editor.$splitter.append(
				@syncButtonsView?.$el
			)

			setTimeout(@ide.layoutManager.resizeAllSplitters, 100)

		teardownSplitView: () ->
			@view.afterSwitchView()

		showPdfPanel: () ->
			@ide.sideBarView.selectLink 'pdf'
			@ide.mainAreaManager.change 'pdf'
			@view.resize()

			if !@view.hasPdf()
				@refreshPdf()
			
		showRawLogPanel: () ->
			@ide.mainAreaManager.change 'rawLog'

		refreshPdf: (opts) ->
			if @ide.project?
				@_refreshPdfWhenProjectIsLoaded(opts)
			else
				@ide.on "afterJoinProject", () =>
					@_refreshPdfWhenProjectIsLoaded(opts)

		_refreshPdfWhenProjectIsLoaded: (opts) ->
			doneCompiling = _.once =>
				@compiling = false
				@view.doneCompiling()
				@syncButtonsView?.show()
			setTimeout doneCompiling, 1000 * 60

			if !@ide.project.get("rootDoc_id")?
				new Modal
					title: "No root document selected"
					message: "First you need to choose a root document via the settings menu. This tells ShareLaTeX which file to run LaTeX on."
					buttons: [{
						text: "OK",
						class: "btn-primary"
					}]
			else if !@compiling
				@view.onCompiling()
				@syncButtonsView?.hide()
				@compiling = true
				@ide.socket.emit "pdfProject", opts, (err, pdfExists, outputFiles) =>
					@compiling = false
					doneCompiling()

					if err? and err.rateLimitHit
						@view.showBeforeCompile()
					else
						if err?
							@view.updateLog(pdfExists: false, logExists: false)
						else
							@fetchLogAndUpdateView(pdfExists)

						if pdfExists
							@view.setPdf("/project/#{@ide.project_id}/output/output.pdf?cache_bust=#{Date.now()}")
							@view.showPdf()
						else
							@view.unsetPdf()
							@view.showLog()
							@syncButtonsView?.hide()

					if outputFiles?
						@view.showOutputFileDownloadLinks(outputFiles)

		fetchLogAndUpdateView: (pdfExists) ->
			$.ajax(
				url: "/project/#{@ide.project_id}/output/output.log"
				success: (body, status, response) =>
					@parseLogAndUpdateView(pdfExists, body)
				error: () =>
					@view.updateLog(pdfExists: pdfExists, logExists: false)
			)

		parseLogAndUpdateView: (pdfExists, log) ->
			errors = LogParser.parse(log, ignoreDuplicates: true)
			lastCompileErrors = {}
			for error in errors.all
				error.file = @_normalizeFilePath(error.file)

				doc_id = @ide.fileTreeManager.getDocIdOfPath(error.file)
				if doc_id?
					lastCompileErrors[doc_id] ||= []
					lastCompileErrors[doc_id].push
						row: error.line - 1
						type: if error.level == "error" then "error" else "warning"
						text: error.message
			@ide.editor.compilationErrors = lastCompileErrors
			@ide.editor.refreshCompilationErrors()

			@view.updateLog(pdfExists: pdfExists, logExists: true, compileErrors: errors, rawLog: log)

		_normalizeFilePath: (path) ->
			path = path.replace(/^compiles\/[0-9a-f]{32}\/(\.\/)?/, "")
			path = path.replace(/^\/compile\//, "")

			rootDoc_id = @ide.project.get("rootDoc_id")
			if rootDoc_id?
				rootDocPath = @ide.fileTreeManager.getPathOfEntityId(rootDoc_id)
				if rootDocPath?
					rootDocDir = rootDocPath.split("/").slice(0,-1).map( (part) -> part + "/" ).join("")
					path = path.replace(/^\.\//, rootDocDir)

			return path

		downloadPdf: () ->
			@ide.mainAreaManager.setIframeSrc "/project/#{@ide.project_id}/output/output.pdf?popupDownload=true"

		deleteCachedFiles: () ->
			modal = new Modal
				title: "Clear cache?"
				message: "This will clear all hidden LaTeX files like .aux, .bbl, etc, from our compile server. You generally don't need to do this unless you're having trouble with references. Your project files will not be deleted or changed."
				buttons: [{
					text: "Cancel"
				}, {
					text: "Clear from cache",
					class: "btn-primary",
					close: false
					callback: ($button) =>
						$button.text("Clearing...")
						$button.prop("disabled", true)
						$.ajax({
							url: "/project/#{@ide.project_id}/output"
							type: "DELETE"
							headers:
								"X-CSRF-Token": window.csrfToken
							complete: () -> modal.remove()
						})

				}]

		syncToCode: (e) ->
			if !e? 
				e = @view.getPdfPosition()
				return if !e?
				# It's not clear exactly where we should sync to if it was directly
				# clicked on, but a little bit down from the very top seems best.
				e.y = e.y + 80

			$.ajax {
				url: "/project/#{@ide.project_id}/sync/pdf"
				data:
					page: e.page + 1
					h: e.x.toFixed(2)
					v: e.y.toFixed(2)
				type: "GET"
				success: (response) =>
					data = JSON.parse(response)
					if data.code and data.code.length > 0
						file = data.code[0].file
						line = data.code[0].line
						@ide.fileTreeManager.openDocByPath(file, line)
			}

		syncToPdf: () ->
			entity_id = @ide.editor.getCurrentDocId()
			file = @ide.fileTreeManager.getPathOfEntityId(entity_id)
			line = @ide.editor.getCurrentLine()
			column = @ide.editor.getCurrentColumn()

			$.ajax {
				url: "/project/#{@ide.project_id}/sync/code"
				data:
					file: file
					line: line + 1
					column: column
				type: "GET"
				success: (response) =>
					data = JSON.parse(response)
					@view.highlightInPdf(data.pdf or [])
			}
