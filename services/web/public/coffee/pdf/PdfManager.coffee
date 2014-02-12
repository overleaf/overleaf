define [
	"utils/Modal"
	"pdf/CompiledView"
	"libs/latex-log-parser"
	"libs/jquery.storage"
	"libs/underscore"
	"libs/backbone"
], (Modal, CompiledView, LogParser) ->
	class PdfManager
		templates:
			pdfLink: $("#pdfSideBarLinkTemplate").html()

		constructor: (@ide) ->
			_.extend @, Backbone.Events
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
			@view.render()
			if $.localStorage("layout.pdf") == "flat"
				@switchToFlatView()
			else if $.localStorage("layout.pdf") == "split"
				@switchToSplitView()
			else if $(window).width() < 1024
				@switchToFlatView()
			else
				@switchToSplitView()

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

					if outputFiles?
						console.log "outputFiles", outputFiles
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
