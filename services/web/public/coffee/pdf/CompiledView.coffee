define [
	"pdf/PDFjsView"
	"pdf/NativePdfView"
	"libs/backbone"
	"libs/mustache"
	"libs/bootstrap"
	"libs/jquery.storage"
], (PdfjsView, NativePdfView) ->
	LatexErrorView = Backbone.View.extend
		constructor: (@ide, @error) ->

		template: $('#compileLogEntryTemplate').html()

		events:
			"click": "onClick"

		render: () ->
			if @error.level == "error"
				@error.type = "error"
				@error.title = "Error in #{@error.file}"
			else if @error.level == "warning"
				@error.type = "warning"
				@error.title = "Warning in #{@error.file}"
			else
				@error.type = "info"
				@error.title = "Typesetting problem in #{@error.file}"
			if @error.line?
				@error.title += " (line #{@error.line})"
			@setElement($(Mustache.to_html(@template, @error)))
	
		onClick: (event) ->
			@ide.fileTreeManager.openDocByPath(@error.file, @error.line)

	PdfView = Backbone.View.extend
		templates:
			pdfPanel: $("#pdfPanelTemplate").html()
			compileSuccess: $('#compileSuccessTemplate').html()
			compileFailed: $('#compileFailedTemplate').html()
			compileError: $('#compileErrorTemplate').html()
			outputFileLink: $('#outputFileLinkTemplate').html()
		
		events:
			"click #recompilePdf": -> @recompilePdf()
			"click #showLog": -> @showLog()
			"click #showRawLog": -> @showRawLog()
			"click #showPdf": -> @showPdf()
			"click #downloadPdf": -> @options.manager.downloadPdf()
			"click #flatViewButton": () ->
				$.localStorage("layout.pdf", "flat")
				@options.manager.switchToFlatView(showPdf: true)
			"click #splitViewButton": ->
				$.localStorage("layout.pdf", "split")
				@options.manager.switchToSplitView()

		initialize: (@options) ->
			@ide = @options.ide
			@ide.layoutManager.on "resize", => @resize()
			@ide.editor.on "resize", => @resize()
			if @ide.userSettings.pdfViewer == "native"
				PdfView = NativePdfView
				@pdfjs = false
			else
				PdfView = PdfjsView
				@pdfjs = true
			@pdfView = new PdfView(manager: @)

		render: () ->
			@setElement(@templates.pdfPanel)
			@$("#pdfAreaContent").append @pdfView.render().$el
			@showBeforeCompile()
			return this

		resize: () ->
			toolbarHeight = @$("#pdfToolBar").outerHeight()
			areaHeight = @$el.outerHeight()
			@$("#pdfAreaContent").height(areaHeight - toolbarHeight)
			@pdfView.onResize?()

		updateLog: (options) ->
			{pdfExists, logExists, compileErrors, rawLog} = options

			if @errorViews?
				for errorView in @errorViews
					errorView.remove()
			@errorViews = []

			errorLogs = @$("#logArea").find('ul')
			errorLogs.empty()

			logButtonHtml = "Logs"

			if compileErrors?
				for error in compileErrors.all
					errorView = new LatexErrorView(@options.manager.ide, error)
					errorView.render()
					@errorViews.push(errorView)
					# TODO: The event handlers introduced by LatexError are never freed
					errorLogs.append(errorView.el)

				if compileErrors.errors.length > 0
					logButtonHtml += " <span class='label label-important'>#{compileErrors.errors.length}</span>"

				if compileErrors.warnings.length > 0
					logButtonHtml += " <span class='label label-warning'>#{compileErrors.warnings.length}</span>"

				if compileErrors.typesetting.length > 0
					logButtonHtml += " <span class='label label-info'>#{compileErrors.typesetting.length}</span>"

			@$("#showLog").html(logButtonHtml)

			if !pdfExists
				if !compileErrors?
					errorLogs.prepend($(@templates.compileError))
				else
					errorLogs.prepend($(@templates.compileFailed))
			else if pdfExists && compileErrors.all.length == 0
				errorLogs.prepend($(@templates.compileSuccess))

			@$("#rawLogArea").find("pre").text(rawLog)
			
		setPdf: (pdfUrl) ->
			@pdfUrl = pdfUrl
			@pdfView.setPdf pdfUrl
			@$("#downloadPdf").removeAttr("disabled")
			@$("#downloadLinksButton").removeAttr("disabled")

		unsetPdf: () ->
			delete @pdfUrl
			@pdfView.unsetPdf()
			@$("#downloadPdf").attr("disabled", "disabled")
			@$("#downloadLinksButton").attr("disabled", "disabled")
			return @

		hasPdf: () -> !!@pdfUrl

		IGNORE_FILES: ["output.fls", "output.fdb_latexmk"]
		showOutputFileDownloadLinks: (outputFiles) ->
			@$("#downloadLinks").empty()
			for file in outputFiles
				if @IGNORE_FILES.indexOf(file.path) == -1
					if file.path.match(/^output\./)
						name = "#{file.path.replace(/^output\./, "")} file"
					else
						name = file.path
					link = $ Mustache.to_html(@templates.outputFileLink, {
						project_id: @ide.project_id
						name: name
						path: file.path
					})
					@$("#downloadLinks").append(link)

		afterSwitchView: ()->
			if !@pdfjs
				@pdfView.unsetPdf()
				@pdfView.hide()
				@$(".not-compiled-yet-message").show()

		showBeforeCompile: () ->
			@pdfView.hide()
			@$("#showPdfGroup").hide()
			@$("#showLog").attr("disabled", "disabled")
			@$("#downloadPdf").attr("disabled", "disabled")
			@$("#downloadLinksButton").attr("disabled", "disabled")
			@$(".compiling-message").hide()
			@$(".not-compiled-yet-message").show()

		showPdf: () ->
			@$("#logArea").hide()
			@$("#rawLogArea").hide()
			@pdfView.show()
			@$("#showPdfGroup").hide()
			@$("#showLogGroup").show()

		showLog: () ->
			@$("#rawLogArea").hide()
			@pdfView.hide()
			@$("#logArea").show()
			@$("#showPdfGroup").show()
			@$("#showLogGroup").hide()

		showRawLog: () ->
			@pdfView.hide()
			@$("#logArea").hide()
			@$("#rawLogArea").show()
			@$("#showPdfGroup").show()
			@$("#showLogGroup").hide()

		onCompiling: () ->
			@$(".not-compiled-yet-message").hide()
			@$(".compiling-message").show()
			@$("#recompilePdf").attr("disabled", "disabled")

		doneCompiling: () ->
			@$(".compiling-message").hide()
			@$("#recompilePdf").removeAttr("disabled")
			@$("#showLog").removeAttr("disabled")

		recompilePdf: () ->
			@options.manager.trigger "compile:pdf"
			@options.manager.refreshPdf()

		toggleFlatViewButton: () -> @$("#flatViewButton").button("toggle")
		toggleSplitViewButton: () -> @$("#splitViewButton").button("toggle")

		downloadPdf: () ->
			@options.manager.downloadPdf()

		delegateEvents: () ->
			Backbone.View::delegateEvents.apply(this, arguments)
			@pdfView.delegateEvents()

		undelegateEvents: () ->
			Backbone.View::undelegateEvents.apply(this, arguments)
			@pdfView.undelegateEvents()

			
