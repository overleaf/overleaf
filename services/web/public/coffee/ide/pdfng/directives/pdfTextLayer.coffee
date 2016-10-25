define [
	"base"
], (App) ->

	# uses the PDFJS text layer renderer to provide invisible overlayed
	# text for searching

	App.factory 'pdfTextLayer', [ () ->

		class pdfTextLayer

			constructor: (options) ->
				@textLayerDiv = options.textLayerDiv
				@divContentDone = false
				@viewport = options.viewport
				@textDivs = []
				@renderer = options.renderer
				@renderingDone = false

			render: (timeout) ->
				if @renderingDone or not @divContentDone
					return

				if @textLayerRenderTask?
					@textLayerRenderTask.cancel()
					@textLayerRenderTask = null

				@textDivs = []
				textLayerFrag = document.createDocumentFragment()

				@textLayerRenderTask = @renderer {
					textContent: this.textContent,
					container: textLayerFrag,
					viewport: this.viewport,
					textDivs: this.textDivs,
					timeout: timeout,
					enhanceTextSelection: this.enhanceTextSelection,
				}

				textLayerSuccess = () =>
					@textLayerDiv.appendChild(textLayerFrag)
					@renderingDone = true

				textLayerFailure = () ->
					return # canceled or failed to render text layer -- skipping errors

				@textLayerRenderTask.promise.then(textLayerSuccess, textLayerFailure)

			setTextContent: (textContent) ->
				if (@textLayerRenderTask)
					@textLayerRenderTask.cancel();
					@textLayerRenderTask = null;

				@textContent = textContent;
				@divContentDone = true;

	]
