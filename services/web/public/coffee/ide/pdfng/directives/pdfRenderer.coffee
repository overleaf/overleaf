define [
	"base"
], (App) ->
	# App = angular.module 'PDFRenderer', ['pdfAnnotations', 'pdfTextLayer']

	App.factory 'PDFRenderer', ['$q', '$timeout', 'pdfAnnotations', 'pdfTextLayer', 'pdfSpinner', ($q, $timeout, pdfAnnotations, pdfTextLayer, pdfSpinner) ->

		class PDFRenderer
			JOB_QUEUE_INTERVAL: 25

			constructor: (@url, @options) ->
				PDFJS.disableFontFace = true  # avoids repaints, uses worker more
				# PDFJS.disableAutoFetch = true # enable this to prevent loading whole file
				# PDFJS.disableStream
				# PDFJS.disableRange
				@scale = @options.scale || 1
				@pdfjs = PDFJS.getDocument @url, null, null, @options.progressCallback
				@document = $q.when(@pdfjs)
				@navigateFn = @options.navigateFn
				@spinner = new pdfSpinner
				@resetState()
				@document.then (pdfDocument) =>
					pdfDocument.getDownloadInfo().then () =>
						@options.loadedCallback()

			resetState: () ->
				@page = []
				@complete = []
				@timeout = []
				@pageLoad = []
				@renderTask = []
				@renderQueue = []
				@jobs = 0

			getNumPages: () ->
				@document.then (pdfDocument) ->
					pdfDocument.numPages

			getPage: (pageNum) ->
				# with promise caching
				return @page[pageNum] if @page[pageNum]?
				@page[pageNum] = @document.then (pdfDocument) ->
					pdfDocument.getPage(pageNum)

			getPdfViewport: (pageNum, scale) ->
				scale ?= @scale
				@document.then (pdfDocument) ->
					pdfDocument.getPage(pageNum).then (page) ->
						viewport = page.getViewport scale

			getDestinations: () ->
				@document.then (pdfDocument) ->
					pdfDocument.getDestinations()

# Not available in pdf.js-1.0.712, in later versions there is a direct
# call for this - we should use it as soon as it is available in a
# stable version
			getDestination: (dest) ->
				@destinations = @document.then (pdfDocument) ->
					pdfDocument.getDestinations()
				return @destinations.then (all) ->
					all[dest]

				@document.then (pdfDocument) ->
					pdfDocument.getDestination(dest)


			getPageIndex: (ref) ->
				@document.then (pdfDocument) ->
					pdfDocument.getPageIndex(ref).then (idx) ->
						idx

			getScale: () ->
				@scale

			setScale: (@scale) ->
				@resetState()

			pause: (element, pagenum) ->
				return if @complete[pagenum]
				return if @shuttingDown
				@renderQueue = @renderQueue.filter (q) ->
					q.pagenum != pagenum
				@spinner.stop(element.canvas)

			triggerRenderQueue: (interval = @JOB_QUEUE_INTERVAL) ->
				$timeout () =>
					@processRenderQueue()
				, interval

			removeCompletedJob: (taskRef, pagenum) ->
				# may need to clean up deferred object here
				delete taskRef[pagenum]
				@jobs = @jobs - 1
				@triggerRenderQueue(0)

			renderPage: (element, pagenum) ->
				return if @shuttingDown
				current = {
					'element': element
					'pagenum': pagenum
				}
				@renderQueue.push(current)
				@triggerRenderQueue()

			processRenderQueue: () ->
				return if @jobs > 0
				current = @renderQueue.shift()
				return unless current?
				[element, pagenum] = [current.element, current.pagenum]
				# if task is underway or complete, go to the next entry in the
				# render queue
				# console.log 'processing renderq', pagenum, @renderTask[pagenum], @complete[pagenum]
				if @pageLoad[pagenum] or @renderTask[pagenum] or @complete[pagenum]
					@processRenderQueue()
					return
				@jobs = @jobs + 1

				element.canvas.addClass('pdfng-loading')
				@spinner.add(element.canvas)

				completeRef = @complete
				renderTaskRef = @renderTask

				@pageLoad[pagenum] = @getPage(pagenum)
				@pageLoad[pagenum].then (pageObject) =>
					@renderTask[pagenum] = @doRender element, pagenum, pageObject
					@renderTask[pagenum].then () =>
						# complete
						completeRef[pagenum] = true
						@removeCompletedJob renderTaskRef, pagenum
					, () =>
						# rejected
						@removeCompletedJob renderTaskRef, pagenum

			doRender: (element, pagenum, page) ->
				self = this
				scale = @scale

				if (not scale?)
					# console.log 'scale is undefined, returning'
					return

				canvas = $('<canvas class="pdf-canvas pdfng-rendering"></canvas>')

				viewport = page.getViewport (scale)

				devicePixelRatio = window.devicePixelRatio || 1

				ctx = canvas[0].getContext '2d'
				backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
					ctx.mozBackingStorePixelRatio ||
					ctx.msBackingStorePixelRatio ||
					ctx.oBackingStorePixelRatio ||
					ctx.backingStorePixelRatio || 1
				pixelRatio = devicePixelRatio / backingStoreRatio

				scaledWidth = (Math.floor(viewport.width) * pixelRatio) | 0
				scaledHeight = (Math.floor(viewport.height) * pixelRatio) | 0

				newWidth = Math.floor(viewport.width)
				newHeight = Math.floor(viewport.height)

				canvas[0].height = scaledHeight
				canvas[0].width = scaledWidth

				canvas.height(newHeight + 'px')
				canvas.width(newWidth + 'px')

				element.canvas.height(newHeight)
				element.canvas.width(newWidth)

				if pixelRatio != 1
					ctx.scale(pixelRatio, pixelRatio)

				textLayer = new pdfTextLayer({
					textLayerDiv: element.text[0]
					viewport: viewport
				})

				annotationsLayer = new pdfAnnotations({
					annotations: element.annotations[0]
					viewport: viewport
					navigateFn: @navigateFn
				})

				element.canvas.replaceWith(canvas)

				result = page.render {
					canvasContext: ctx
					viewport: viewport
				}

				result.then () ->
					canvas.removeClass('pdfng-rendering')
					page.getTextContent().then (textContent) ->
						textLayer.setTextContent textContent
					page.getAnnotations().then (annotations) ->
						annotationsLayer.setAnnotations annotations

				return result

			destroy: () ->
				# console.log 'in pdf renderer destroy', @renderQueue
				@shuttingDown = true
				@renderQueue = []
				for task in @renderTask
					task.cancel() if task?
				@pdfjs.then (document) ->
					document.cleanup()
					document.destroy()

		]
