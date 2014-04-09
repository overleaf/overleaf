define [
	"libs/pdfListView/PdfListView"
	"libs/pdfListView/TextLayerBuilder"
	"libs/pdfListView/AnnotationsLayerBuilder"
	"libs/pdfListView/HighlightsLayerBuilder"
	"text!libs/pdfListView/TextLayer.css"
	"text!libs/pdfListView/AnnotationsLayer.css"
	"text!libs/pdfListView/HighlightsLayer.css"
	"libs/backbone"
	"libs/jquery.storage"
], (PDFListView, TextLayerBuilder, AnnotationsLayerBuilder, HighlightsLayerBuilder, textLayerCss, annotationsLayerCss, highlightsLayerCss) ->
	if PDFJS?
		PDFJS.workerSrc = "#{window.sharelatex.pdfJsWorkerPath}"

	style = $("<style/>")
	style.text(textLayerCss + "\n" + annotationsLayerCss + "\n" + highlightsLayerCss)
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
				highlightsLayerBuilder: HighlightsLayerBuilder
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

		highlightInPdf: (areas) ->
			highlights = for area in (areas or [])
				{
					page: area.page - 1
					highlight:
						left: area.h
						top: area.v
						height: area.height
						width: area.width
				}

			if highlights.length > 0
				first = highlights[0]
				@pdfListView.setPdfPosition({
					page: first.page
					offset:
						left: first.highlight.left
						top: first.highlight.top - 80
				}, true)

			@pdfListView.clearHighlights()
			@pdfListView.setHighlights(highlights, true)
			
			setTimeout () =>
				@$(".pdfjs-list-view .plv-highlights-layer > div").fadeOut "slow", () =>
					@pdfListView.clearHighlights()
			, 1000

		getPdfPosition: () ->
			position = @pdfListView.getPdfPosition(true)
			return if !position?
			return {
				page: position.page
				x: position.offset.left
				y: position.offset.top
			}


			

