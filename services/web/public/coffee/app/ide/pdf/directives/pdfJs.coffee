define [
	"base"
	"libs/pdfListView/PdfListView"
	"libs/pdfListView/TextLayerBuilder"
	"libs/pdfListView/AnnotationsLayerBuilder"
	"libs/pdfListView/HighlightsLayerBuilder"
	"text!libs/pdfListView/TextLayer.css"
	"text!libs/pdfListView/AnnotationsLayer.css"
	"text!libs/pdfListView/HighlightsLayer.css"
], (
	App
	PDFListView
	TextLayerBuilder
	AnnotationsLayerBuilder
	HighlightsLayerBuilder
	textLayerCss
	annotationsLayerCss
	highlightsLayerCss
) ->
	if PDFJS?
		PDFJS.workerSrc = "#{window.sharelatex.pdfJsWorkerPath}"

	style = $("<style/>")
	style.text(textLayerCss + "\n" + annotationsLayerCss + "\n" + highlightsLayerCss)
	$("body").append(style)

	App.directive "pdfjs", () ->
		return {
			scope: {
				"pdfSrc": "="
			}
			link: (scope, element, attrs) ->
				pdfListView = new PDFListView element.find(".pdfjs-viewer")[0],
					textLayerBuilder: TextLayerBuilder
					annotationsLayerBuilder: AnnotationsLayerBuilder
					highlightsLayerBuilder: HighlightsLayerBuilder
					logLevel: PDFListView.Logger.DEBUG
				pdfListView.listView.pageWidthOffset = 20
				pdfListView.listView.pageHeightOffset = 20

				scope.loading = false

				onProgress = (progress) ->
					scope.$apply () ->
						scope.progress = Math.floor(progress.loaded/progress.total*100)
						console.log "PROGRESS", scope.progress, progress.loaded, progress.total

				scope.$watch "pdfSrc", (url) ->
					if url
						scope.loading = true
						scope.progress = 0

						pdfListView
							.loadPdf(url, onProgress)
							.then () ->
								scope.$apply () ->
									scope.loading = false
									delete scope.progress

			template: """
				<div class="pdfjs-viewer"></div>
				<div class="progress-thin" ng-show="loading">
					<div class="progress-bar" ng-style="{ 'width': progress + '%' }"></div>
				</div>
			"""
		}