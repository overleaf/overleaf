define [
	"base"
	"ide/pdfng/directives/pdfTextLayer"
	"ide/pdfng/directives/pdfAnnotations"
	"ide/pdfng/directives/pdfHighlights"
	"ide/pdfng/directives/pdfRenderer"
	"ide/pdfng/directives/pdfPage"
	"ide/pdfng/directives/pdfViewer"
	"libs/pdf"
	"text!libs/pdfListView/TextLayer.css"
	"text!libs/pdfListView/AnnotationsLayer.css"
	"text!libs/pdfListView/HighlightsLayer.css"
], (
	App
	pdfViewer
	pdfPage
	pdfRenderer
	pdfTextLayer
	pdfAnnotations
	pdfHighlights
	pdf
	textLayerCss
	annotationsLayerCss
	highlightsLayerCss
) ->
	if PDFJS?
		PDFJS.workerSrc = window.pdfJsWorkerPath
		PDFJS.disableAutoFetch = true

	style = $("<style/>")
	style.text(textLayerCss + "\n" + annotationsLayerCss + "\n" + highlightsLayerCss)
	$("body").append(style)

	App.directive "pdfjs", ["$timeout", ($timeout) ->
		return {
			scope: {
					"pdfSrc": "="
					"highlights": "="
					"position": "="
					"dblClickCallback": "="
			}
			link: (scope, element, attrs) ->
				# pdfListView = new PDFListView element.find(".pdfjs-viewer")[0],
				#		textLayerBuilder: TextLayerBuilder
				#		annotationsLayerBuilder: AnnotationsLayerBuilder
				#		highlightsLayerBuilder: HighlightsLayerBuilder
				#		ondblclick: (e) -> onDoubleClick(e)
				#		# logLevel: PDFListView.Logger.DEBUG
				# pdfListView.listView.pageWidthOffset = 20
				# pdfListView.listView.pageHeightOffset = 20

				scope.loading = false
				scope.pleaseJumpTo = {}
				scope.scale = {}
				initializedPosition = false
				initializePosition = () ->
					return if initializedPosition
					initializedPosition = true

					if (scale = $.localStorage("pdf.scale"))?
						scope.scale = { scaleMode: scale.scaleMode, scale: +scale.scale}
					else
						scope.scale = { scaleMode: 'scale_mode_fit_width' }

					if (position = $.localStorage("pdf.position.#{attrs.key}"))
						scope.position = { page: +position.page, offset: { "top": +position.offset.top, "left": +position.offset.left } }

					#scope.position = pdfListView.getPdfPosition(true)

					$(window).unload () =>
						$.localStorage "pdf.scale", scope.scale
						$.localStorage "pdf.position.#{attrs.key}", scope.position

				flashControls = () ->
					scope.flashControls = true
					$timeout () ->
						scope.flashControls = false
					, 1000

#				element.find(".pdfjs-viewer").scroll () ->
#					scope.position = pdfListView.getPdfPosition(true)

				onDoubleClick = (e) ->
					console.log 'double click event'
					scope.dblClickCallback?(page: e.page, offset: { top: e.y, left: e.x })

				scope.$watch "pdfSrc", (url) ->
					if url
						scope.loading = true
						console.log 'pdfSrc =', url
						initializePosition()
						flashControls()
						scope.$broadcast 'layout-ready'
						# pdfListView
						#		.loadPdf(url, onProgress)
						#		.then () ->
						#			scope.$apply () ->
						#				scope.loading = false
						#				delete scope.progress
						#				initializePosition()
						#				flashControls()

				scope.$watch "highlights", (areas) ->
					console.log 'got HIGHLIGHTS in pdfJS', areas
					return if !areas?
					highlights = for area in areas or []
						{
							page: area.page
							highlight:
								left: area.h
								top: area.v
								height: area.height
								width: area.width
						}

					if highlights.length > 0
						first = highlights[0]
						position = {
							page: first.page
							offset:
								left: first.highlight.left
								top: first.highlight.top - 80
						}
						console.log 'position is', position, 'in highlights'
						scope.pleaseJumpTo = position
					# pdfListView.clearHighlights()
					# pdfListView.setHighlights(highlights, true)

					# setTimeout () =>
					#		pdfListView.clearHighlights()
					# , 1000

				scope.fitToHeight = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_fit_height'
					scope.scale = scale

				scope.fitToWidth = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_fit_width'
					scope.scale = scale

				scope.zoomIn = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_value'
					scale.scale = scale.scale * 1.2
					scope.scale = scale

				scope.zoomOut = () ->
					scale = angular.copy (scope.scale)
					scale.scaleMode = 'scale_mode_value'
					scale.scale = scale.scale / 1.2
					scope.scale = scale

				if attrs.resizeOn?
					for event in attrs.resizeOn.split(",")
						scope.$on event, (e) ->
							console.log 'got a resize event', event, e

			template: """
				<div data-pdf-viewer class="pdfjs-viewer" pdf-src='pdfSrc' position='position' scale='scale' highlights='highlights' dbl-click-callback='dblClickCallback' please-jump-to='pleaseJumpTo'></div>
				<div class="pdfjs-controls" ng-class="{'flash': flashControls }">
					<div class="btn-group">
						<a href
							class="btn btn-info btn-lg"
							ng-click="fitToWidth()"
							tooltip="Fit to Width"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-arrows-h"></i>
						</a>
						<a href
							class="btn btn-info btn-lg"
							ng-click="fitToHeight()"
							tooltip="Fit to Height"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-arrows-v"></i>
						</a>
						<a href
							class="btn btn-info btn-lg"
							ng-click="zoomIn()"
							tooltip="Zoom In"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-search-plus"></i>
						</a>
						<a href
							class="btn btn-info btn-lg"
							ng-click="zoomOut()"
							tooltip="Zoom Out"
							tooltip-append-to-body="true"
							tooltip-placement="bottom"
						>
							<i class="fa fa-fw fa-search-minus"></i>
						</a>
					</div>
				</div>
			"""
		}
	]
