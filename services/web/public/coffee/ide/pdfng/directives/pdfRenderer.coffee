define [
	"base"
], (App) ->
	# App = angular.module 'PDFRenderer', ['pdfAnnotations', 'pdfTextLayer']

	App.factory 'PDFRenderer', ['$q', '$timeout', 'pdfAnnotations', 'pdfTextLayer', 'pdfSpinner', ($q, $timeout, pdfAnnotations, pdfTextLayer, pdfSpinner) ->

		class PDFRenderer
			JOB_QUEUE_INTERVAL: 25
			PAGE_LOAD_TIMEOUT: 60*1000
			PAGE_RENDER_TIMEOUT: 60*1000

			constructor: (@url, @options) ->
				# PDFJS.disableFontFace = true  # avoids repaints, uses worker more
				# PDFJS.disableAutoFetch = true # enable this to prevent loading whole file
				# PDFJS.disableStream
				# PDFJS.disableRange
				@scale = @options.scale || 1
				@pdfjs = PDFJS.getDocument {url: @url, rangeChunkSize: 2*65536}
				@pdfjs.onProgress = @options.progressCallback
				@document = $q.when(@pdfjs)
				@navigateFn = @options.navigateFn
				@spinner = new pdfSpinner
				@resetState()
				@document.then (pdfDocument) =>
					pdfDocument.getDownloadInfo().then () =>
						@options.loadedCallback()
				@errorCallback = @options.errorCallback
				@pageSizeChangeCallback = @options.pageSizeChangeCallback
				@pdfjs.promise.catch (exception) =>
					# console.log 'ERROR in get document', exception
					@errorCallback(exception)

			resetState: () ->
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
				@document.then (pdfDocument) ->
					# console.log 'got pdf document, now getting Page', pageNum
					pdfDocument.getPage(pageNum)

			getPdfViewport: (pageNum, scale) ->
				scale ?= @scale
				@document.then (pdfDocument) =>
					pdfDocument.getPage(pageNum).then (page) ->
						viewport = page.getViewport scale
					, (error) =>
						@errorCallback?(error)

			getDestinations: () ->
				@document.then (pdfDocument) ->
					pdfDocument.getDestinations()

			getDestination: (dest) ->
				@document.then (pdfDocument) ->
					pdfDocument.getDestination(dest)
				, (error) =>
					@errorCallback?(error)

			getPageIndex: (ref) ->
				@document.then (pdfDocument) =>
					pdfDocument.getPageIndex(ref).then (idx) ->
						idx
					, (error) =>
						@errorCallback?(error)

			getScale: () ->
				@scale

			setScale: (@scale) ->
				@resetState()

			triggerRenderQueue: (interval = @JOB_QUEUE_INTERVAL) ->
				@queueTimer = setTimeout () =>
					@queueTimer = null
					@processRenderQueue()
				, interval

			removeCompletedJob: (taskRef, pagenum) ->
				# may need to clean up deferred object here
				delete taskRef[pagenum]
				@jobs = @jobs - 1
				@triggerRenderQueue(0)

			renderPages: (pages) ->
				return if @shuttingDown
				@renderQueue = for page in pages
					{
						'element': page.elementChildren
						'pagenum': page.pageNum
					}
				@triggerRenderQueue()

			renderPage: (page) ->
				return if @shuttingDown
				current =		{
					'element': page.elementChildren
					'pagenum': page.pageNum
				}
				@renderQueue.push current
				@processRenderQueue()

			processRenderQueue: () ->
				return if @shuttingDown
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
				spinTimer = setTimeout () =>
					@spinner.add(element.canvas)
				, 100

				completeRef = @complete
				renderTaskRef = @renderTask
				# console.log 'started page load', pagenum

				timedOut = false
				timer = $timeout () =>
					Raven?.captureMessage?('pdfng page load timed out after ' + @PAGE_LOAD_TIMEOUT + 'ms (1% sample)') if Math.random() < 0.01
					# console.log 'page load timed out', pagenum
					timedOut = true
					clearTimeout(spinTimer)
					@spinner.stop(element.canvas)
					# @jobs = @jobs - 1
					# @triggerRenderQueue(0)
					@errorCallback?('timeout')
				, @PAGE_LOAD_TIMEOUT

				@pageLoad[pagenum] = @getPage(pagenum)

				@pageLoad[pagenum].then (pageObject) =>
					# console.log 'in page load success', pagenum
					$timeout.cancel(timer)
					clearTimeout(spinTimer)
					@renderTask[pagenum] = @doRender element, pagenum, pageObject
					@renderTask[pagenum].then () =>
						# complete
						# console.log 'render task success', pagenum
						completeRef[pagenum] = true
						@removeCompletedJob renderTaskRef, pagenum
					, () =>
						# console.log 'render task failed', pagenum
						# rejected
						@removeCompletedJob renderTaskRef, pagenum
				.catch (error) ->
					# console.log 'in page load error', pagenum, 'timedOut=', timedOut
					$timeout.cancel(timer)
					clearTimeout(spinTimer)
					# console.log 'ERROR', error

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

				oldHeight = element.canvas.height()
				oldWidth = element.canvas.width()
				if newHeight != oldHeight  or  newWidth != oldWidth
					element.canvas.height(newHeight + 'px')
					element.canvas.width(newWidth + 'px')
					element.container.height(newHeight + 'px')
					element.container.width(newWidth + 'px')
					@pageSizeChangeCallback?(pagenum, newHeight - oldHeight)

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

				# console.log 'staring page render', pagenum

				result = page.render {
					canvasContext: ctx
					viewport: viewport
					transform: [pixelRatio, 0, 0, pixelRatio, 0, 0]
				}

				timedOut = false

				timer = $timeout () =>
					Raven?.captureMessage?('pdfng page render timed out after ' + @PAGE_RENDER_TIMEOUT + 'ms (1% sample)') if Math.random() < 0.01
					# console.log 'page render timed out', pagenum
					timedOut = true
					result.cancel()
				, @PAGE_RENDER_TIMEOUT

				result.then () ->
					# console.log 'page rendered', pagenum
					$timeout.cancel(timer)
					canvas.removeClass('pdfng-rendering')
					page.getTextContent().then (textContent) ->
						textLayer.setTextContent textContent
					, (error) ->
						self.errorCallback?(error)
					page.getAnnotations().then (annotations) ->
						annotationsLayer.setAnnotations annotations
					, (error) ->
						self.errorCallback?(error)
				.catch (error) ->
					# console.log 'page render failed', pagenum, error
					$timeout.cancel(timer)
					if timedOut
						# console.log 'calling ERROR callback - was timeout'
						self.errorCallback?('timeout')
					else if error != 'cancelled'
						# console.log 'calling ERROR callback'
						self.errorCallback?(error)

				return result

			destroy: () ->
				# console.log 'in pdf renderer destroy', @renderQueue
				@shuttingDown = true
				clearTimeout @queueTimer if @queueTimer?
				@renderQueue = []
				for task in @renderTask
					task.cancel() if task?
				@pdfjs.then (document) ->
					document.cleanup()
					document.destroy()

		]
