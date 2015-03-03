define [
	"base"
], (App) ->
	#app = angular.module 'pdfHighlights', []

	App.factory 'pdfHighlights', [ () ->
		class pdfHighlights

			constructor: (options) ->
				@highlightsLayerDiv = options.highlights[0]
				@highlightElements = []

			addHighlight: (viewport, left, top, width, height) ->
				rect = viewport.convertToViewportRectangle([left, top, left + width, top + height])
				rect = PDFJS.Util.normalizeRect(rect)
				element = document.createElement("div")
				element.style.left = Math.floor(rect[0]) + 'px'
				element.style.top = Math.floor(rect[1]) + 'px'
				element.style.width = Math.ceil(rect[2] - rect[0]) + 'px'
				element.style.height = Math.ceil(rect[3] - rect[1]) + 'px'
				@highlightElements.push(element)
				@highlightsLayerDiv.appendChild(element)
				element

			clearHighlights: () ->
				for h in @highlightElements
					h?.parentNode.removeChild(h)
				@highlightElements = []
	]
