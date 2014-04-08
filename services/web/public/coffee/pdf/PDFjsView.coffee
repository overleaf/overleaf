define [
	"libs/pdfListView/PdfListView"
	"libs/pdfListView/TextLayerBuilder"
	"libs/pdfListView/AnnotationsLayerBuilder"
	"text!libs/pdfListView/TextLayer.css"
	"text!libs/pdfListView/AnnotationsLayer.css"
	"libs/backbone"
	"libs/jquery.storage"
], (PDFListView, TextLayerBuilder, AnnotationsLayerBuilder, textLayerCss, annotationsLayerCss) ->
	if PDFJS?
		PDFJS.workerSrc = "#{window.sharelatex.pdfJsWorkerPath}"

	style = $("<style/>")
	style.text(textLayerCss + "\n" + annotationsLayerCss)
	$("body").append(style)

	PDFjsView = Backbone.View.extend
		template: $("#pdfjsViewerTemplate").html()

		events:
			"mousemove"            : "onMousemove"
			"mouseout"             : "onMouseout"
			"click .js-fit-height" : "fitToHeight"
			"click .js-fit-width"  : "fitToWidth"
			"click .js-zoom-out"   : "zoomOut"
			"click .js-zoom-in"    : "zoomIn"

		initialize: () ->
			@ide = @options.manager.ide

		render: () ->
			@setElement $(@template)
			@pdfListView = new PDFListView @$(".pdfjs-list-view")[0],
				textLayerBuilder: TextLayerBuilder
				annotationsLayerBuilder: AnnotationsLayerBuilder
				ondblclick: (e) =>
					@trigger "dblclick", e
				#logLevel: PDFListView.Logger.DEBUG
			@pdfListView.listView.pageWidthOffset = 20
			@pdfListView.listView.pageHeightOffset = 20
			@toolbar = @$(".btn-group")
			@toolbar.hide()
			@progress_bar = @$(".progress")
			@hideProgressBar()
			return @

		show: () ->
			@$el.show()
			@pdfListView.onResize()

		hide: () -> @$el.hide()

		setPdf: (url) ->
			@setProgressBarTo(0)
			onProgress = (progress) =>
				@setProgressBarTo(progress.loaded/progress.total)
			@pdfListView
				.loadPdf(url, onProgress)
				.then () =>
					@hideProgressBar()
					if !@setInitialPosition
						@_initInitialPosition()
						@setInitialPosition = true
					@flashToolbar()

		unsetPdf: () -> @hide()

		_initInitialPosition: () ->
			if (scale = $.localStorage("pdf.scale"))?
				@pdfListView.setScaleMode(scale.scaleMode, scale.scale)
			else
				@pdfListView.setToFitWidth()

			if (position = $.localStorage("pdf.position.#{@ide.project.get("id")}"))
				@pdfListView.setPdfPosition(position)

			$(window).unload () =>
				$.localStorage "pdf.scale", {
					scaleMode: @pdfListView.getScaleMode()
					scale: @pdfListView.getScale()
				}
				$.localStorage "pdf.position.#{@ide.project.get("id")}", @pdfListView.getPdfPosition()

		setProgressBarTo: (value) ->
			@progress_bar.show()
			@progress_bar.find(".bar").css width: "#{value * 100}%"

		hideProgressBar: () ->
			@progress_bar.hide()

		fitToHeight: () ->
			@pdfListView.setToFitHeight()

		fitToWidth: () ->
			@pdfListView.setToFitWidth()

		zoomIn: () ->
			scale = @pdfListView.getScale()
			@pdfListView.setScale(scale * 1.2)

		zoomOut: () ->
			scale = @pdfListView.getScale()
			@pdfListView.setScale(scale / 1.2)

		flashToolbar: () ->
			@toolbar.show()
			setTimeout =>
				@toolbar.fadeOut "slow"
			, 1000

		onMousemove: (e) ->
			viewerOffset = @$el.offset()
			offsetY = e.pageY - viewerOffset.top
			offsetX = e.pageX - viewerOffset.left
			if offsetY < 70 and offsetX < 250
				@toolbar.show()
			else
				@toolbar.fadeOut "slow"

		onMouseout: (e) ->
			@toolbar.hide()

		onResize: () ->
			@pdfListView.onResize()

